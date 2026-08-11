/**
 * Processamento de eventos de webhook AbacatePay (lógica pura + admin client).
 * Eventos tratados: subscription.completed | renewed | cancelled.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  limiteDoPlano,
  planoPorProdutoId,
  produtoEmailExtraId,
  registrarUso,
} from "@/lib/abacatepay";
import type { Database, Json } from "@/lib/database.types";
import type { PlanoId } from "@/config/pricing";

export type AdminClient = SupabaseClient<Database>;

export type WebhookPayload = {
  id?: string;
  event?: string;
  data?: {
    subscription?: {
      id?: string;
      status?: string;
      externalId?: string | null;
    };
    checkout?: {
      externalId?: string | null;
      items?: Array<{ id?: string; quantity?: number }>;
    };
    payment?: {
      externalId?: string | null;
    };
  };
};

export function extrairExternalIdAssinatura(
  payload: WebhookPayload,
): string | null {
  const candidates = [
    payload.data?.checkout?.externalId,
    payload.data?.payment?.externalId,
    payload.data?.subscription?.externalId,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

export function extrairProdutoId(payload: WebhookPayload): string | null {
  const item = payload.data?.checkout?.items?.[0];
  return item?.id ?? null;
}

async function jaProcessado(
  admin: AdminClient,
  eventoId: string | undefined,
): Promise<boolean> {
  if (!eventoId) return false;
  const { data } = await admin
    .from("webhooks_log")
    .select("id")
    .eq("provedor", "abacatepay")
    .eq("processado", true)
    .contains("payload", { id: eventoId })
    .limit(1);
  return (data?.length ?? 0) > 0;
}

async function localizarAssinatura(
  admin: AdminClient,
  payload: WebhookPayload,
) {
  const externalId = extrairExternalIdAssinatura(payload);
  if (externalId) {
    const { data } = await admin
      .from("assinaturas")
      .select("*")
      .eq("id", externalId)
      .maybeSingle();
    if (data) return data;
  }

  const subId = payload.data?.subscription?.id;
  if (subId) {
    const { data } = await admin
      .from("assinaturas")
      .select("*")
      .eq("abacatepay_subscription_id", subId)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

async function registrarUsosRenovacao(
  admin: AdminClient,
  assinatura: {
    id: string;
    user_id: string;
    abacatepay_subscription_id: string | null;
  },
): Promise<void> {
  if (!assinatura.abacatepay_subscription_id) return;

  const { data: obras } = await admin
    .from("obras")
    .select("id")
    .eq("owner_id", assinatura.user_id)
    .is("arquivada_em", null);

  const obraIds = (obras ?? []).map((o) => o.id);
  if (obraIds.length === 0) return;

  const { count } = await admin
    .from("obra_acessos")
    .select("id", { count: "exact", head: true })
    .in("obra_id", obraIds)
    .eq("cobrado_extra", true);

  const n = count ?? 0;
  if (n <= 0) return;

  const uso = await registrarUso({
    id: assinatura.abacatepay_subscription_id,
    productId: produtoEmailExtraId(),
    units: n,
    action: "add",
  });

  await admin.from("assinatura_usos").insert({
    assinatura_id: assinatura.id,
    action: "add",
    units: n,
    abacatepay_usage_id: uso.id,
    installment_number: uso.installmentNumber,
    obra_acesso_id: null,
  });
}

export async function processarEventoAssinatura(
  admin: AdminClient,
  payload: WebhookPayload,
): Promise<{ ok: boolean; mensagem: string }> {
  const evento = payload.event ?? "desconhecido";

  if (payload.id && (await jaProcessado(admin, payload.id))) {
    return { ok: true, mensagem: "evento ja processado (idempotente)" };
  }

  if (
    evento !== "subscription.completed" &&
    evento !== "subscription.renewed" &&
    evento !== "subscription.cancelled"
  ) {
    return { ok: true, mensagem: `evento ignorado: ${evento}` };
  }

  const assinatura = await localizarAssinatura(admin, payload);
  if (!assinatura) {
    throw new Error(
      `Assinatura local nao encontrada para evento ${evento} (externalId/subId)`,
    );
  }

  if (evento === "subscription.completed") {
    const produtoId = extrairProdutoId(payload);
    let plano: PlanoId | null = produtoId
      ? planoPorProdutoId(produtoId)
      : null;
    if (!plano && assinatura.plano !== "trial") {
      plano = assinatura.plano as PlanoId;
    }
    if (!plano) {
      throw new Error(
        `Nao foi possivel mapear produto ${produtoId ?? "?"} para plano`,
      );
    }

    const subId = payload.data?.subscription?.id ?? null;
    const { error } = await admin
      .from("assinaturas")
      .update({
        status: "ativa",
        plano,
        limite_obras: limiteDoPlano(plano),
        abacatepay_subscription_id: subId,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", assinatura.id);

    if (error) throw new Error(error.message);
    return { ok: true, mensagem: `assinatura ${assinatura.id} ativada (${plano})` };
  }

  if (evento === "subscription.renewed") {
    const { error } = await admin
      .from("assinaturas")
      .update({
        status: "ativa",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", assinatura.id);
    if (error) throw new Error(error.message);

    // Passo 4 do algoritmo de e-mail extra (§5.4)
    await registrarUsosRenovacao(admin, assinatura);
    return {
      ok: true,
      mensagem: `assinatura ${assinatura.id} renovada + usos e-mail extra`,
    };
  }

  // subscription.cancelled
  const { error } = await admin
    .from("assinaturas")
    .update({
      status: "cancelada",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", assinatura.id);
  if (error) throw new Error(error.message);
  return { ok: true, mensagem: `assinatura ${assinatura.id} cancelada` };
}

export async function gravarWebhookLog(
  admin: AdminClient,
  evento: string,
  payload: Json,
  processado: boolean,
  erro: string | null,
): Promise<string> {
  const { data, error } = await admin
    .from("webhooks_log")
    .insert({
      provedor: "abacatepay",
      evento,
      payload,
      processado,
      erro,
    })
    .select("id")
    .single();

  if (error) throw new Error(`webhooks_log: ${error.message}`);
  return data.id;
}

export async function marcarWebhookProcessado(
  admin: AdminClient,
  logId: string,
  processado: boolean,
  erro: string | null,
): Promise<void> {
  await admin
    .from("webhooks_log")
    .update({ processado, erro })
    .eq("id", logId);
}
