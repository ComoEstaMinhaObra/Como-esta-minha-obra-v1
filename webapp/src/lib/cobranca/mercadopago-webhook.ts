/**
 * Processamento das notificações do Mercado Pago (assinaturas), server-only.
 *
 * A notificação traz só o tipo e o id do recurso: o estado verdadeiro vem de uma consulta à API.
 * Idempotência por (provedor, id do evento), em que o id do evento inclui o estado consultado
 * (o mesmo recurso é notificado várias vezes, com estados diferentes). Cobrança por obra: a obra
 * vem do `external_reference` da assinatura.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { OBRA_ATIVA } from "@/config/pricing";
import { avisarPagamentoPendente } from "@/lib/cobranca/job";
import type { Database, Json } from "@/lib/database.types";
import { logSeguro, sanitizarErro } from "@/lib/log";
import {
  consultarAssinatura,
  consultarParcela,
  type AssinaturaMp,
  type ParcelaMp,
} from "@/lib/mercadopago";

export type AdminClient = SupabaseClient<Database>;

export const TOPICO_ASSINATURA = "subscription_preapproval";
export const TOPICO_PARCELA = "subscription_authorized_payment";

export interface NotificacaoMp {
  /** `type` do corpo da notificação (ou `topic` do IPN antigo). */
  tipo: string;
  /** `data.id` do corpo, o id do recurso. */
  dataId: string;
  acao?: string;
}

export interface DepsMp {
  consultarAssinatura: (id: string) => Promise<AssinaturaMp>;
  consultarParcela: (id: string) => Promise<ParcelaMp>;
  avisarPagamentoPendente: typeof avisarPagamentoPendente;
  agora: () => Date;
}

const DEPS_PADRAO: DepsMp = {
  consultarAssinatura,
  consultarParcela,
  avisarPagamentoPendente,
  agora: () => new Date(),
};

export type EventoCobranca =
  | { tipo: "autorizada" }
  | { tipo: "paga" }
  | { tipo: "falhou" }
  | { tipo: "cancelada" }
  | { tipo: "ignorado"; motivo: string };

/** Traduz o estado consultado (assinatura e, quando houver, parcela) para um evento do app. */
export function interpretarEstado(
  assinatura: AssinaturaMp,
  parcela: ParcelaMp | null,
): EventoCobranca {
  if (assinatura.status === "cancelled") return { tipo: "cancelada" };
  if (assinatura.status !== "authorized") {
    return { tipo: "ignorado", motivo: `assinatura ${assinatura.status}` };
  }
  if (!parcela) return { tipo: "autorizada" };

  const pagamento = parcela.payment?.status;
  if (parcela.status === "processed" && pagamento === "approved") {
    return { tipo: "paga" };
  }
  // Recusa: a parcela entra em nova tentativa (recycling) ou esgota as tentativas já recusada.
  if (
    parcela.status === "recycling" ||
    (parcela.status === "processed" && pagamento !== undefined && pagamento !== "approved")
  ) {
    return { tipo: "falhou" };
  }
  return { tipo: "ignorado", motivo: `parcela ${parcela.status}` };
}

/**
 * A obra só é liberada com a assinatura autorizada e a 1ª parcela paga, ou com a 1ª cobrança
 * adiada (free_trial) ainda no futuro.
 */
export function podeRegistrar(a: AssinaturaMp, agora: Date): boolean {
  if (a.status !== "authorized") return false;
  if ((a.summarized?.charged_quantity ?? 0) >= 1) return true;
  const proxima = a.next_payment_date ? new Date(a.next_payment_date) : null;
  return Boolean(a.auto_recurring.free_trial && proxima && proxima > agora);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Erros de negócio sem retentativa útil: viram log e resposta 200. COBRANCA_DUPLICADA fica de fora de propósito (ver `registrarCobrancaAssinatura`). */
const ERROS_PERMANENTES = ["COBRANCA_OBRA_DIVERGENTE", "COBRANCA_AUSENTE", "OBRA_AUSENTE"];

function somarUmMes(d: Date): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + 1);
  return r;
}

export type ResultadoRegistro =
  | { ok: true; criada: boolean }
  | { ok: false; erro: string };

/**
 * Registra a cobrança da obra a partir de uma assinatura autorizada (fn_cobranca_registrar, que é
 * idempotente por assinatura). Usada na hora da contratação e pelo webhook, que é a segunda via.
 * Lança em erro transitório (inclusive COBRANCA_DUPLICADA: durante a regularização a cobrança
 * antiga só é encerrada depois, então tentar de novo resolve; o provedor reenvia a notificação).
 */
export async function registrarCobrancaAssinatura(
  admin: AdminClient,
  assinatura: AssinaturaMp,
  agora: Date = new Date(),
): Promise<ResultadoRegistro> {
  const obraId = assinatura.external_reference ?? "";
  if (!UUID_RE.test(obraId)) return { ok: false, erro: "OBRA_AUSENTE" };
  const { data: obra } = await admin.from("obras").select("id").eq("id", obraId).maybeSingle();
  if (!obra) return { ok: false, erro: "OBRA_AUSENTE" };

  const fim = assinatura.next_payment_date
    ? new Date(assinatura.next_payment_date)
    : somarUmMes(agora);
  const criadaEm = assinatura.date_created ? new Date(assinatura.date_created) : agora;
  const inicio = criadaEm < fim ? criadaEm : agora;
  const adiada = Boolean(assinatura.auto_recurring.free_trial) &&
    (assinatura.summarized?.charged_quantity ?? 0) === 0;

  const { data, error } = await admin.rpc("fn_cobranca_registrar", {
    p_obra: obraId,
    p_subscription_id: assinatura.id,
    p_checkout_id: null as unknown as string,
    p_valor_centavos: OBRA_ATIVA.precoCentavos,
    p_periodo_inicio: inicio.toISOString(),
    p_periodo_fim: fim.toISOString(),
    p_primeira_cobranca_em: (adiada ? fim.toISOString() : null) as unknown as string,
  });
  if (error) {
    const msg = error.message ?? sanitizarErro(error);
    if (ERROS_PERMANENTES.some((c) => msg.includes(c))) return { ok: false, erro: msg };
    throw new Error(sanitizarErro(error));
  }
  return { ok: true, criada: Boolean((data as { criada?: boolean } | null)?.criada) };
}

async function marcarProcessado(
  admin: AdminClient,
  logId: string,
  erro: string | null = null,
  processado = true,
) {
  await admin
    .from("webhooks_log")
    .update({ processado, processado_em: new Date().toISOString(), erro })
    .eq("id", logId);
}

async function localizarCobranca(admin: AdminClient, subId: string) {
  const { data } = await admin
    .from("cobrancas_obra")
    .select("id, obra_id, status")
    .eq("provedor_assinatura_id", subId)
    .maybeSingle();
  return data;
}

function payloadSeguro(
  n: NotificacaoMp,
  a: AssinaturaMp,
  p: ParcelaMp | null,
): Json {
  return {
    tipo: n.tipo,
    acao: n.acao ?? null,
    dataId: n.dataId,
    assinaturaId: a.id,
    assinaturaStatus: a.status,
    parcelaStatus: p?.status ?? null,
    pagamentoStatus: p?.payment?.status ?? null,
  };
}

export async function processarNotificacaoMp(
  admin: AdminClient,
  notificacao: NotificacaoMp,
  opcoes: { forcar?: boolean; eventId?: string; deps?: Partial<DepsMp> } = {},
): Promise<{ ok: boolean; mensagem: string }> {
  if (notificacao.tipo !== TOPICO_ASSINATURA && notificacao.tipo !== TOPICO_PARCELA) {
    return { ok: true, mensagem: `evento ignorado: ${notificacao.tipo}` };
  }
  if (!notificacao.dataId) return { ok: false, mensagem: "EVENTO_SEM_ID" };

  const d = { ...DEPS_PADRAO, ...opcoes.deps };

  // O estado vem da API, não do corpo. Falha aqui devolve 5xx e o provedor reenvia.
  let parcela: ParcelaMp | null = null;
  let assinatura: AssinaturaMp;
  if (notificacao.tipo === TOPICO_PARCELA) {
    parcela = await d.consultarParcela(notificacao.dataId);
    assinatura = await d.consultarAssinatura(parcela.preapproval_id);
  } else {
    assinatura = await d.consultarAssinatura(notificacao.dataId);
  }

  // Reprocessar pelo admin reaproveita o id do log original; senão o id inclui o estado consultado.
  const eventId = opcoes.eventId ?? (parcela
    ? `parcela:${parcela.id}:${parcela.status}:${parcela.payment?.status ?? "-"}:${parcela.last_modified ?? ""}`
    : `assinatura:${assinatura.id}:${assinatura.status}:${assinatura.last_modified ?? ""}`);

  const { data: claim, error: claimErr } = await admin.rpc("fn_claim_webhook_evento", {
    p_event_id: eventId,
    p_evento: notificacao.tipo,
    p_payload: payloadSeguro(notificacao, assinatura, parcela),
    p_force: opcoes.forcar ?? false,
    p_provedor: "mercadopago",
  });
  if (claimErr) throw new Error(sanitizarErro(claimErr));
  const c = claim as { logId: string; duplicado: boolean; emProcessamento?: boolean };
  if (c.duplicado) {
    return {
      ok: true,
      mensagem: c.emProcessamento
        ? "evento já está em processamento"
        : "evento ja processado (idempotente)",
    };
  }

  try {
    const evento = interpretarEstado(assinatura, parcela);
    const agora = d.agora();
    const cobranca = await localizarCobranca(admin, assinatura.id);

    if (evento.tipo === "ignorado") {
      await marcarProcessado(admin, c.logId);
      return { ok: true, mensagem: `ignorado: ${evento.motivo}` };
    }

    if (evento.tipo === "cancelada") {
      if (!cobranca) {
        // Cancelada antes de registrada (regularização desfeita, cartão trocado): nada a fazer.
        await marcarProcessado(admin, c.logId);
        return { ok: true, mensagem: "cancelada sem cobranca registrada" };
      }
      const { data, error } = await admin.rpc("fn_cobranca_cancelada_webhook", {
        p_subscription_id: assinatura.id,
      });
      if (error) throw new Error(sanitizarErro(error));
      const resultado = (data as { resultado?: string } | null)?.resultado ?? "";
      if (resultado === "cancelada_sem_pedido") {
        // Sem pedido do app: cancelamento direto no painel ou 3 parcelas recusadas. O admin confere.
        logSeguro("error", { evento: "cobranca_cancelada_sem_pedido" });
        await marcarProcessado(admin, c.logId, "CANCELADA_SEM_PEDIDO");
      } else {
        await marcarProcessado(admin, c.logId);
      }
      return { ok: true, mensagem: `cobranca: ${resultado}` };
    }

    if (evento.tipo === "falhou") {
      if (!cobranca) {
        await marcarProcessado(admin, c.logId);
        return { ok: true, mensagem: "falha de parcela sem cobranca registrada" };
      }
      const { data, error } = await admin.rpc("fn_cobranca_marcar_inadimplente", {
        p_subscription_id: assinatura.id,
        p_agora: agora.toISOString(),
      });
      if (error) throw new Error(sanitizarErro(error));
      const r = data as { alterada?: boolean; userId?: string; obraId?: string } | null;
      if (r?.alterada && r.userId && r.obraId) {
        await d.avisarPagamentoPendente(admin, {
          userId: r.userId,
          obraId: r.obraId,
          agora,
        });
      }
      await marcarProcessado(admin, c.logId);
      return {
        ok: true,
        mensagem: r?.alterada ? "cobranca inadimplente" : "falha ignorada",
      };
    }

    // autorizada ou paga
    if (!cobranca) {
      if (!podeRegistrar(assinatura, agora)) {
        await marcarProcessado(admin, c.logId);
        return { ok: true, mensagem: "aguardando a primeira cobranca" };
      }
      const r = await registrarCobrancaAssinatura(admin, assinatura, agora);
      if (!r.ok) {
        await marcarProcessado(admin, c.logId, r.erro, false);
        return { ok: false, mensagem: r.erro };
      }
      await marcarProcessado(admin, c.logId);
      return { ok: true, mensagem: `cobranca da obra ${assinatura.external_reference} registrada` };
    }

    if (evento.tipo === "paga") {
      const { data, error } = await admin.rpc("fn_cobranca_renovar", {
        p_subscription_id: assinatura.id,
        p_agora: agora.toISOString(),
        p_periodo_fim: (assinatura.next_payment_date ?? null) as unknown as string,
      });
      if (error) throw new Error(sanitizarErro(error));
      const alterada = (data as { alterada?: boolean } | null)?.alterada;
      await marcarProcessado(admin, c.logId);
      return { ok: true, mensagem: alterada ? "cobranca renovada" : "renovacao ignorada" };
    }

    await marcarProcessado(admin, c.logId);
    return { ok: true, mensagem: "assinatura ja registrada" };
  } catch (e) {
    await admin
      .from("webhooks_log")
      .update({ processado: false, erro: sanitizarErro(e) })
      .eq("id", c.logId);
    throw e;
  }
}
