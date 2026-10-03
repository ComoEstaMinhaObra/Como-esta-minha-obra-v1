"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCobrancaEnv, publicEnv } from "@/config/env";
import {
  AbacatePayError,
  cancelarAssinatura,
  criarAssinatura,
  criarCliente,
  garantirProdutoObraComTrial,
  RETRY_POLICY_OBRA,
} from "@/lib/abacatepay";
import { logSeguro, sanitizarErro } from "@/lib/log";
import { codigoRpc } from "@/lib/rpc-erros";
import { createClient } from "@/lib/supabase/server";

export type ErroContratar =
  | "NAO_AUTENTICADO"
  | "RATE_LIMITED"
  | "SEM_PERMISSAO"
  | "OBRA_ARQUIVADA"
  | "JA_CONTRATADA"
  | "REATIVAR_APOS"
  | "ASSINATURA_ANTIGA"
  | "PRODUTO_NAO_CONFIGURADO"
  | "FALHA_CLIENTE"
  | "FALHA_CHECKOUT";

const PLACEHOLDER = /xxx|preench|placeholder/i;

/**
 * Abre o checkout da assinatura de UMA obra (R$ 129,90 por mês). O externalId do checkout é o id
 * da obra: o webhook localiza a obra por ele. Se há período pago aproveitável (obra arquivada,
 * regra Q1), usa o produto com trialDays, e a primeira cobrança fica para o fim desse período.
 */
export async function contratarObra(obraId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, erro: "NAO_AUTENTICADO" as const };

  const { error: rlErr } = await supabase.rpc("fn_consumir_rate_limit", {
    p_acao: "checkout",
  });
  if (rlErr) return { ok: false as const, erro: "RATE_LIMITED" as const };

  const { data: obra } = await supabase
    .from("obras")
    .select("id, owner_id, arquivada_em")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id) {
    return { ok: false as const, erro: "SEM_PERMISSAO" as const };
  }
  if (obra.arquivada_em) {
    return { ok: false as const, erro: "OBRA_ARQUIVADA" as const };
  }

  // Cobrança não cancelada da obra: ativa/inadimplente já está contratada; cancelamento
  // agendado só reativa depois de acesso_ate (decisão D4).
  const { data: existente } = await supabase
    .from("cobrancas_obra")
    .select("status, acesso_ate")
    .eq("obra_id", obraId)
    .neq("status", "cancelada")
    .maybeSingle();
  if (existente) {
    if (
      existente.status === "cancelamento_agendado" &&
      existente.acesso_ate &&
      new Date(existente.acesso_ate) > new Date()
    ) {
      return {
        ok: false as const,
        erro: "REATIVAR_APOS" as const,
        acessoAte: existente.acesso_ate,
      };
    }
    if (existente.status !== "cancelamento_agendado") {
      return { ok: false as const, erro: "JA_CONTRATADA" as const };
    }
  }

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("status, abacatepay_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!assinatura) return { ok: false as const, erro: "SEM_PERMISSAO" as const };
  // Conta ativa do modelo antigo já cobre a obra; contratar de novo cobraria em duplicidade.
  if (assinatura.status === "ativa" && !existente) {
    const { count } = await supabase
      .from("cobrancas_obra")
      .select("id", { count: "exact", head: true })
      .eq("obra_id", obraId);
    if (!count) return { ok: false as const, erro: "ASSINATURA_ANTIGA" as const };
  }

  let customerId = assinatura.abacatepay_customer_id;
  if (!customerId) {
    try {
      const { data: perfil } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();
      const cliente = await criarCliente({
        email: user.email,
        name: perfil?.nome || undefined,
      });
      customerId = cliente.id;
      const { error } = await supabase.rpc("fn_registrar_customer_id", {
        p_customer_id: customerId,
      });
      if (error) throw error;
    } catch (e) {
      logSeguro("error", { evento: "checkout_cliente", ids: { obraId } });
      void sanitizarErro(e);
      return { ok: false as const, erro: "FALHA_CLIENTE" as const };
    }
  }

  try {
    const { data: vaga } = await supabase.rpc("fn_vaga_paga_disponivel");
    const v = vaga as { disponivel?: boolean; dias?: number } | null;

    let produtoId: string;
    if (v?.disponivel && v.dias && v.dias >= 1) {
      produtoId = await garantirProdutoObraComTrial(v.dias);
    } else {
      const env = getCobrancaEnv();
      produtoId = env.ABACATEPAY_PROD_OBRA_ATIVA ?? "";
      if (!produtoId || PLACEHOLDER.test(produtoId)) {
        return { ok: false as const, erro: "PRODUTO_NAO_CONFIGURADO" as const };
      }
    }

    const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const checkout = await criarAssinatura({
      items: [{ id: produtoId, quantity: 1 }],
      customerId,
      externalId: obraId,
      methods: ["CARD"],
      retryPolicy: { ...RETRY_POLICY_OBRA },
      metadata: { obraId },
      returnUrl: `${appUrl}/cobranca`,
      completionUrl: `${appUrl}/cobranca?sucesso=1&obra=${obraId}`,
    });
    if (!checkout.url) {
      return { ok: false as const, erro: "FALHA_CHECKOUT" as const };
    }
    redirect(checkout.url);
  } catch (e) {
    // redirect() lança NEXT_REDIRECT: não engolir.
    if (
      e &&
      typeof e === "object" &&
      "digest" in e &&
      typeof (e as { digest?: unknown }).digest === "string" &&
      (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
    ) {
      throw e;
    }
    // O detalhe técnico fica só no log; o usuário vê uma mensagem própria.
    logSeguro("error", { evento: "checkout_obra", ids: { obraId } });
    void (e instanceof AbacatePayError ? sanitizarErro(e) : null);
    return { ok: false as const, erro: "FALHA_CHECKOUT" as const };
  }
}

export interface ResultadoCancelamento {
  obraId: string;
  ok: boolean;
  erro?: string;
  acessoAte?: string;
}

/**
 * Cancela a cobrança de uma ou mais obras. Grava a intenção ANTES de chamar o provedor (que
 * cancela na hora) e desfaz se o provedor falhar. A obra mantém os recursos até o fim do período
 * já pago (acesso_ate).
 */
export async function cancelarCobrancas(obraIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const resultados: ResultadoCancelamento[] = [];
  for (const obraId of [...new Set(obraIds)].slice(0, 20)) {
    const { data, error } = await supabase.rpc("fn_cobranca_solicitar_cancelamento", {
      p_obra: obraId,
    });
    if (error) {
      resultados.push({ obraId, ok: false, erro: codigoRpc(error) });
      continue;
    }
    const r = data as { subscriptionId: string; acessoAte: string };
    try {
      await cancelarAssinatura(r.subscriptionId);
      resultados.push({ obraId, ok: true, acessoAte: r.acessoAte });
    } catch (e) {
      logSeguro("error", { evento: "cancelar_cobranca", ids: { obraId } });
      void (e instanceof AbacatePayError ? sanitizarErro(e) : null);
      await supabase.rpc("fn_cobranca_desfazer_cancelamento", { p_obra: obraId });
      resultados.push({ obraId, ok: false, erro: "FALHA_PROVEDOR" });
    }
  }

  revalidatePath("/cobranca");
  revalidatePath("/obras");
  return { ok: true as const, resultados };
}
