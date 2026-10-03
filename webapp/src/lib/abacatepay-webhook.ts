/**
 * Processamento de eventos de webhook AbacatePay.
 * Idempotência por (provedor, event_id). Payload persistido allowlisted. Cobrança por obra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { consultarAssinatura } from "@/lib/abacatepay";
import type { Database, Json } from "@/lib/database.types";
import { OBRA_ATIVA } from "@/config/pricing";
import { logSeguro, sanitizarErro } from "@/lib/log";

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Erros de negócio sem retentativa útil: registra no log e responde 200 em vez de 500. */
const ERROS_PERMANENTES = [
  "COBRANCA_DUPLICADA",
  "COBRANCA_OBRA_DIVERGENTE",
  "COBRANCA_AUSENTE",
  "OBRA_AUSENTE",
];

function somarUmMes(d: Date): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + 1);
  return r;
}

async function marcarProcessado(
  admin: AdminClient,
  logId: string,
  erro: string | null = null,
  processado = true,
) {
  await admin
    .from("webhooks_log")
    .update({
      processado,
      processado_em: new Date().toISOString(),
      erro,
    })
    .eq("id", logId);
}

async function localizarCobranca(admin: AdminClient, subId: string) {
  const { data } = await admin
    .from("cobrancas_obra")
    .select("id, obra_id, status")
    .eq("abacatepay_subscription_id", subId)
    .maybeSingle();
  return data;
}

/** O externalId do checkout por obra é o id da obra (o legado usa o id da assinatura da conta). */
async function localizarObra(admin: AdminClient, externalId: string | null) {
  if (!externalId || !UUID_RE.test(externalId)) return null;
  const { data } = await admin
    .from("obras")
    .select("id")
    .eq("id", externalId)
    .maybeSingle();
  return data;
}

type AlvoCobranca = { cobrancaObraId?: string; obraId?: string };

/**
 * Cobrança por obra (decisões de 01/10/2026; payloads confirmados no spike E0, 03/10/2026):
 * a obra vem de data.checkout.externalId; data.subscription.externalId é nulo; o payload não traz
 * datas de período nem o motivo do cancelamento.
 */
async function processarCobrancaObra(
  admin: AdminClient,
  payload: WebhookPayload,
  evento: string,
  logId: string,
  alvo: AlvoCobranca,
): Promise<{ ok: boolean; mensagem: string }> {
  const subId = payload.data?.subscription?.id;
  if (!subId) throw new Error("ASSINATURA_SEM_ID");

  const falhar = async (msg: string) => {
    await marcarProcessado(admin, logId, msg, false);
    return { ok: false, mensagem: msg };
  };
  const permanente = (msg: string) =>
    ERROS_PERMANENTES.some((c) => msg.includes(c));

  if (evento === "subscription.completed" || evento === "subscription.trial_started") {
    const obraId = alvo.obraId;
    if (!obraId) return falhar("OBRA_AUSENTE");

    const agora = new Date();
    let fim = somarUmMes(agora);
    let primeira: string | null = null;
    let checkoutId: string | null = null;

    if (evento === "subscription.trial_started") {
      // Assinatura com início adiado (produto com trialDays): a primeira cobrança é o fim do trial.
      const consulta = await consultarAssinatura(subId);
      if (!consulta?.trialEndsAt) throw new Error("TRIAL_SEM_DATA");
      fim = new Date(consulta.trialEndsAt);
      primeira = fim.toISOString();
      checkoutId = consulta.checkoutId ?? null;
    }

    const { error } = await admin.rpc("fn_cobranca_registrar", {
      p_obra: obraId,
      p_subscription_id: subId,
      p_checkout_id: checkoutId as string,
      p_valor_centavos: OBRA_ATIVA.precoCentavos,
      p_periodo_inicio: agora.toISOString(),
      p_periodo_fim: fim.toISOString(),
      p_primeira_cobranca_em: primeira as string,
    });
    if (error) {
      const msg = sanitizarErro(error);
      if (permanente(error.message ?? msg)) return falhar(error.message ?? msg);
      throw new Error(msg);
    }
    await marcarProcessado(admin, logId);
    return { ok: true, mensagem: `cobranca da obra ${obraId} registrada` };
  }

  if (evento === "subscription.renewed") {
    const { data, error } = await admin.rpc("fn_cobranca_renovar", {
      p_subscription_id: subId,
    });
    if (error) {
      const msg = sanitizarErro(error);
      if (permanente(error.message ?? msg)) return falhar(error.message ?? msg);
      throw new Error(msg);
    }
    await marcarProcessado(admin, logId);
    const alterada = (data as { alterada?: boolean } | null)?.alterada;
    return {
      ok: true,
      mensagem: alterada ? "cobranca renovada" : "renovacao ignorada",
    };
  }

  // subscription.cancelled
  const { data, error } = await admin.rpc("fn_cobranca_cancelada_webhook", {
    p_subscription_id: subId,
  });
  if (error) {
    const msg = sanitizarErro(error);
    if (permanente(error.message ?? msg)) return falhar(error.message ?? msg);
    throw new Error(msg);
  }
  const resultado = (data as { resultado?: string } | null)?.resultado ?? "";
  if (resultado === "cancelada_sem_pedido") {
    // Sem pedido do app: tentativas esgotadas ou cancelamento direto no painel. O admin confere.
    logSeguro("error", { evento: "cobranca_cancelada_sem_pedido" });
    await marcarProcessado(admin, logId, "CANCELADA_SEM_PEDIDO");
  } else {
    await marcarProcessado(admin, logId);
  }
  return { ok: true, mensagem: `cobranca: ${resultado}` };
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
    evento !== "subscription.cancelled" &&
    evento !== "subscription.trial_started"
  ) {
    await admin
      .from("webhooks_log")
      .update({ processado: true, processado_em: new Date().toISOString(), erro: null })
      .eq("id", c.logId);
    return { ok: true, mensagem: `evento ignorado: ${evento}` };
  }

  try {
    // Cobrança por obra: assinatura já registrada, ou externalId do checkout igual ao id de uma obra.
    const subId = payload.data?.subscription?.id ?? null;
    const cobranca = subId ? await localizarCobranca(admin, subId) : null;
    const obra = cobranca
      ? null
      : await localizarObra(admin, extrairExternalIdAssinatura(payload));
    if (cobranca || obra) {
      return await processarCobrancaObra(admin, payload, evento, c.logId, {
        cobrancaObraId: cobranca?.id,
        obraId: cobranca?.obra_id ?? obra?.id,
      });
    }

    // Nem uma cobrança registrada nem uma obra: assinatura desconhecida (por exemplo, de um checkout
    // antigo por conta). Fica no log para conferência; não adianta o provedor tentar de novo.
    await marcarProcessado(admin, c.logId, "ASSINATURA_AUSENTE", false);
    return { ok: false, mensagem: "ASSINATURA_AUSENTE" };
  } catch (e) {
    await admin
      .from("webhooks_log")
      .update({ processado: false, erro: sanitizarErro(e) })
      .eq("id", c.logId);
    throw e;
  }
}
