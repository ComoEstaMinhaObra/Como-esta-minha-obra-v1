"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { publicEnv } from "@/config/env";
import {
  PLANOS,
  type PlanoId,
  planoPorId,
} from "@/config/pricing";
import {
  AbacatePayError,
  criarAssinatura,
  criarCliente,
  produtoIdDoPlano,
  trocarPlano,
} from "@/lib/abacatepay";
import { createClient } from "@/lib/supabase/server";

function isPlanoId(v: string): v is PlanoId {
  return PLANOS.some((p) => p.id === v);
}

export async function iniciarCheckout(planoIdRaw: string) {
  if (!isPlanoId(planoIdRaw)) {
    return { ok: false as const, erro: "PLANO_INVALIDO" };
  }
  const planoId = planoIdRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select(
      "id, status, plano, abacatepay_customer_id, abacatepay_subscription_id",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assinatura) return { ok: false as const, erro: "SEM_ASSINATURA" };

  if (assinatura.status === "ativa") {
    return { ok: false as const, erro: "JA_ASSINANTE" };
  }

  // Garante customer AbacatePay
  let customerId = assinatura.abacatepay_customer_id;
  if (!customerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .maybeSingle();

    try {
      const customer = await criarCliente({
        email: user.email,
        name: profile?.nome || undefined,
      });
      customerId = customer.id;
      await supabase
        .from("assinaturas")
        .update({ abacatepay_customer_id: customerId })
        .eq("id", assinatura.id);
    } catch (e) {
      const msg = e instanceof AbacatePayError ? e.message : String(e);
      return { ok: false as const, erro: `CLIENTE: ${msg}` };
    }
  }

  const productId = produtoIdDoPlano(planoId);
  if (/xxx|preench|placeholder/i.test(productId)) {
    return { ok: false as const, erro: "PRODUTO_NAO_CONFIGURADO" };
  }

  const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  try {
    const checkout = await criarAssinatura({
      items: [{ id: productId, quantity: 1 }],
      customerId,
      externalId: assinatura.id,
      methods: ["CARD"],
      returnUrl: `${appUrl}/planos`,
      completionUrl: `${appUrl}/planos?sucesso=1`,
    });

    if (!checkout.url) {
      return { ok: false as const, erro: "SEM_URL_CHECKOUT" };
    }

    redirect(checkout.url);
  } catch (e) {
    // redirect() lança NEXT_REDIRECT — não engolir
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      typeof (e as { digest?: string }).digest === "string" &&
      (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    const msg = e instanceof AbacatePayError ? e.message : String(e);
    return { ok: false as const, erro: `CHECKOUT: ${msg}` };
  }
}

export async function agendarTrocaDePlano(planoIdRaw: string) {
  if (!isPlanoId(planoIdRaw)) {
    return { ok: false as const, erro: "PLANO_INVALIDO" };
  }
  const planoId = planoIdRaw;
  const novo = planoPorId(planoId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("id, status, plano, limite_obras, abacatepay_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assinatura || assinatura.status !== "ativa") {
    return { ok: false as const, erro: "PRECISA_ASSINATURA_ATIVA" };
  }
  if (!assinatura.abacatepay_subscription_id) {
    return { ok: false as const, erro: "SEM_SUBSCRIPTION_ID" };
  }
  if (assinatura.plano === planoId) {
    return { ok: false as const, erro: "MESMO_PLANO" };
  }

  // Downgrade: bloquear se obras ativas > novo limite
  const { count } = await supabase
    .from("obras")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id)
    .is("arquivada_em", null);

  const obrasAtivas = count ?? 0;
  if (obrasAtivas > novo.limiteObras) {
    const excesso = obrasAtivas - novo.limiteObras;
    return {
      ok: false as const,
      erro: "ARQUIVAR_ANTES",
      excesso,
      mensagem: `Arquive ${excesso} obra(s) antes de reduzir o plano.`,
    };
  }

  try {
    await trocarPlano({
      id: assinatura.abacatepay_subscription_id,
      productId: produtoIdDoPlano(planoId),
      quantity: 1,
    });
  } catch (e) {
    const msg = e instanceof AbacatePayError ? e.message : String(e);
    return { ok: false as const, erro: `TROCA: ${msg}` };
  }

  revalidatePath("/planos");
  return {
    ok: true as const,
    mensagem: "Alteração agendada para o próximo ciclo",
  };
}
