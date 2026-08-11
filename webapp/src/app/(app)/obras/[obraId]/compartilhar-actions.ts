"use server";

import { revalidatePath } from "next/cache";
import {
  produtoEmailExtraId,
  registrarUso,
  AbacatePayError,
} from "@/lib/abacatepay";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { podeAdicionarEmailExtra } from "@/lib/gating";
import type { AssinaturaStatus } from "@/lib/gating";

export async function listarAcessosObra(obraId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obra_acessos")
    .select("id, email, status, cobrado_extra, user_id, criado_em")
    .eq("obra_id", obraId)
    .order("criado_em", { ascending: true });
  if (error) return { ok: false as const, erro: error.message, acessos: [] };
  return { ok: true as const, acessos: data ?? [] };
}

export async function liberarAcessoObra(obraId: string, email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm.includes("@")) {
    return { ok: false as const, erro: "EMAIL_INVALIDO" };
  }

  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome, owner_id, arquivada_em")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id || obra.arquivada_em) {
    return { ok: false as const, erro: "SEM_PERMISSAO" };
  }

  const { data: existentes } = await supabase
    .from("obra_acessos")
    .select("id, email")
    .eq("obra_id", obraId);

  if ((existentes ?? []).some((a) => a.email.toLowerCase() === emailNorm)) {
    return { ok: false as const, erro: "EMAIL_DUPLICADO" };
  }

  const cobradoExtra = (existentes?.length ?? 0) >= 1;

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select(
      "id, status, limite_obras, trial_fim, relatorios_enviados_trial, abacatepay_subscription_id",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (cobradoExtra) {
    const pode = podeAdicionarEmailExtra({
      status: (assinatura?.status ?? "trial") as AssinaturaStatus,
      limiteObras: assinatura?.limite_obras ?? 1,
      obrasAtivas: 0,
      trialFim: assinatura?.trial_fim ? new Date(assinatura.trial_fim) : null,
      relatoriosEnviadosTrial: assinatura?.relatorios_enviados_trial ?? 0,
    });

    if (!pode) {
      return { ok: false as const, erro: "PRECISA_ASSINAR" };
    }
  }

  const { data: acessoCriado, error } = await supabase
    .from("obra_acessos")
    .insert({
      obra_id: obraId,
      email: emailNorm,
      status: "convidado",
      cobrado_extra: cobradoExtra,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, erro: error.message };

  // Algoritmo §5.4 passo 2: assinatura ativa + cobrado_extra → record-usage add
  if (
    cobradoExtra &&
    assinatura?.status === "ativa" &&
    assinatura.abacatepay_subscription_id &&
    acessoCriado
  ) {
    try {
      const uso = await registrarUso({
        id: assinatura.abacatepay_subscription_id,
        productId: produtoEmailExtraId(),
        units: 1,
        action: "add",
      });
      // assinatura_usos: escrita só via service role (RLS)
      const admin = createAdminClient();
      await admin.from("assinatura_usos").insert({
        assinatura_id: assinatura.id,
        obra_acesso_id: acessoCriado.id,
        action: "add",
        units: 1,
        abacatepay_usage_id: uso.id,
        installment_number: uso.installmentNumber,
      });
    } catch (e) {
      console.error(
        "[email-extra:add]",
        e instanceof AbacatePayError ? e.message : e,
      );
    }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const { enviarEmailConvite } = await import("@/lib/email/enviar");
    await enviarEmailConvite({
      para: emailNorm,
      empreiteiro: profile?.nome || user.email || "Empreiteiro",
      obraNome: obra.nome,
    });
  } catch (e) {
    console.error("[email:convite] falha", e);
  }

  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const, cobradoExtra };
}

export async function removerAcessoObra(obraId: string, acessoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: obra } = await supabase
    .from("obras")
    .select("id, owner_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id) {
    return { ok: false as const, erro: "SEM_PERMISSAO" };
  }

  const { data: acesso } = await supabase
    .from("obra_acessos")
    .select("id, cobrado_extra")
    .eq("id", acessoId)
    .eq("obra_id", obraId)
    .maybeSingle();

  if (!acesso) return { ok: false as const, erro: "NAO_ENCONTRADO" };

  // Algoritmo §5.4 passo 3: se cobrado e há add pendente no mesmo installment → subtract
  if (acesso.cobrado_extra) {
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("id, status, abacatepay_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      assinatura?.status === "ativa" &&
      assinatura.abacatepay_subscription_id
    ) {
      const { data: usoAdd } = await supabase
        .from("assinatura_usos")
        .select("id, installment_number")
        .eq("assinatura_id", assinatura.id)
        .eq("obra_acesso_id", acessoId)
        .eq("action", "add")
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usoAdd?.installment_number != null) {
        const { data: jaSubtract } = await supabase
          .from("assinatura_usos")
          .select("id")
          .eq("assinatura_id", assinatura.id)
          .eq("obra_acesso_id", acessoId)
          .eq("action", "subtract")
          .eq("installment_number", usoAdd.installment_number)
          .maybeSingle();

        if (!jaSubtract) {
          try {
            const uso = await registrarUso({
              id: assinatura.abacatepay_subscription_id,
              productId: produtoEmailExtraId(),
              units: 1,
              action: "subtract",
            });
            const admin = createAdminClient();
            await admin.from("assinatura_usos").insert({
              assinatura_id: assinatura.id,
              obra_acesso_id: acessoId,
              action: "subtract",
              units: 1,
              abacatepay_usage_id: uso.id,
              installment_number: uso.installmentNumber,
            });
          } catch (e) {
            console.error(
              "[email-extra:subtract]",
              e instanceof AbacatePayError ? e.message : e,
            );
          }
        }
      }
    }
  }

  const { error } = await supabase
    .from("obra_acessos")
    .delete()
    .eq("id", acessoId)
    .eq("obra_id", obraId);

  if (error) return { ok: false as const, erro: error.message };

  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const };
}
