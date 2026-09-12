/**
 * Processamento de eventos de webhook AbacatePay.
 * Idempotência por (provedor, event_id). Payload persistido allowlisted.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { limiteDoPlano, planoPorProdutoId } from "@/lib/abacatepay";
import type { Database, Json } from "@/lib/database.types";
import type { PlanoId } from "@/config/pricing";
import { processarOutbox } from "@/lib/outbox";
import { sanitizarErro } from "@/lib/log";

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

export function sanitizarPayloadWebhook(payload: WebhookPayload): Json {
  return {
    id: payload.id ?? null,
    event: payload.event ?? null,
    data: {
      subscription: {
        id: payload.data?.subscription?.id ?? null,
        status: payload.data?.subscription?.status ?? null,
        externalId: payload.data?.subscription?.externalId ?? null,
      },
      checkout: {
        externalId: payload.data?.checkout?.externalId ?? null,
        items: (payload.data?.checkout?.items ?? []).map((i) => ({
          id: i.id ?? null,
          quantity: i.quantity ?? null,
        })),
      },
      payment: {
        externalId: payload.data?.payment?.externalId ?? null,
      },
    },
  };
}

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

export async function processarEventoAssinatura(
  admin: AdminClient,
  payload: WebhookPayload,
  opcoes: { forcar?: boolean } = {},
): Promise<{ ok: boolean; mensagem: string }> {
  const evento = payload.event ?? "desconhecido";
  const eventId = payload.id;
  if (!eventId) {
    return { ok: false, mensagem: "EVENTO_SEM_ID" };
  }

  const { data: claim, error: claimErr } = await admin.rpc(
    "fn_claim_webhook_evento",
    {
      p_event_id: eventId,
      p_evento: evento,
      p_payload: sanitizarPayloadWebhook(payload),
      p_force: opcoes.forcar ?? false,
    },
  );
  if (claimErr) throw new Error(sanitizarErro(claimErr));
  const c = claim as {
    logId: string;
    duplicado: boolean;
    emProcessamento?: boolean;
  };
  if (c.duplicado) {
    return {
      ok: true,
      mensagem: c.emProcessamento
        ? "evento já está em processamento"
        : "evento ja processado (idempotente)",
    };
  }

  if (
    evento !== "subscription.completed" &&
    evento !== "subscription.renewed" &&
    evento !== "subscription.cancelled"
  ) {
    await admin
      .from("webhooks_log")
      .update({ processado: true, processado_em: new Date().toISOString(), erro: null })
      .eq("id", c.logId);
    return { ok: true, mensagem: `evento ignorado: ${evento}` };
  }

  try {
    const assinatura = await localizarAssinatura(admin, payload);
    if (!assinatura) {
      throw new Error("ASSINATURA_AUSENTE");
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
        throw new Error("PRODUTO_NAO_MAPEADO");
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
      if (error) throw new Error(sanitizarErro(error));
      await admin
        .from("webhooks_log")
        .update({ processado: true, processado_em: new Date().toISOString(), erro: null })
        .eq("id", c.logId);
      return { ok: true, mensagem: `assinatura ${assinatura.id} ativada` };
    }

    if (evento === "subscription.renewed") {
      const { error } = await admin
        .from("assinaturas")
        .update({
          status: "ativa",
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", assinatura.id);
      if (error) throw new Error(sanitizarErro(error));

      const { data: outbox } = await admin.rpc("fn_enfileirar_renovacao_emails", {
        p_assinatura: assinatura.id,
        p_event_id: eventId,
        p_parcela: 0,
      });
      const ids = ((outbox as { outboxIds?: string[] } | null)?.outboxIds) ?? [];
      for (const id of ids) {
        await processarOutbox(id);
      }
      await admin
        .from("webhooks_log")
        .update({ processado: true, processado_em: new Date().toISOString(), erro: null })
        .eq("id", c.logId);
      return { ok: true, mensagem: `assinatura ${assinatura.id} renovada` };
    }

    const { error } = await admin
      .from("assinaturas")
      .update({
        status: "cancelada",
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", assinatura.id);
    if (error) throw new Error(sanitizarErro(error));
    await admin
      .from("webhooks_log")
      .update({ processado: true, processado_em: new Date().toISOString(), erro: null })
      .eq("id", c.logId);
    return { ok: true, mensagem: `assinatura ${assinatura.id} cancelada` };
  } catch (e) {
    await admin
      .from("webhooks_log")
      .update({ processado: false, erro: sanitizarErro(e) })
      .eq("id", c.logId);
    throw e;
  }
}
