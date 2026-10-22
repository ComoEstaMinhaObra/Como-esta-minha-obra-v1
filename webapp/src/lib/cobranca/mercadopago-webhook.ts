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
import { reverterDesconto } from "@/lib/afiliados/desconto";
import { avisarPagamentoPendente } from "@/lib/cobranca/job";
import type { Database, Json } from "@/lib/database.types";
import { logSeguro, sanitizarErro } from "@/lib/log";
import {
  atualizarValorAssinatura,
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
  atualizarValorAssinatura: typeof atualizarValorAssinatura;
  agora: () => Date;
}

const DEPS_PADRAO: DepsMp = {
  consultarAssinatura,
  consultarParcela,
  avisarPagamentoPendente,
  atualizarValorAssinatura,
  agora: () => new Date(),
};

export type EventoCobranca =
  | { tipo: "autorizada" }
  | { tipo: "paga" }
  | { tipo: "falhou" }
  | { tipo: "cancelada" }
  | { tipo: "ignorado"; motivo: string };

/** Parcela cobrada com pagamento aprovado: o único sinal de dinheiro recebido. */
export function pagamentoAprovado(parcela: ParcelaMp | null): boolean {
  return parcela?.status === "processed" && parcela.payment?.status === "approved";
}

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
  if (pagamentoAprovado(parcela)) {
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

/** Valor mensal da assinatura no provedor (com desconto de afiliado, se houver); sem valor válido, o preço de tabela. */
function valorCobradoCentavos(a: AssinaturaMp): number {
  const centavos = Math.round(Number(a.auto_recurring.transaction_amount) * 100);
  return Number.isFinite(centavos) && centavos > 0 ? centavos : OBRA_ATIVA.precoCentavos;
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
    p_valor_centavos: valorCobradoCentavos(assinatura),
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

/** O service_role não lê a tabela direto: a consulta passa por função (fn_cobranca_por_assinatura). */
async function localizarCobranca(admin: AdminClient, subId: string) {
  const { data, error } = await admin.rpc("fn_cobranca_por_assinatura", {
    p_subscription_id: subId,
  });
  if (error) throw new Error(sanitizarErro(error));
  return (data as { id: string; obraId: string; userId: string; status: string } | null) ?? null;
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

/**
 * Comissão do programa de afiliados por pagamento aprovado (fn_afiliado_registrar_pagamento,
 * idempotente pelo id do pagamento). O banco decide se há indicação; sem ela é um no-op barato.
 * Também devolve ao preço cheio a assinatura com desconto de "primeira fatura" que acabou de pagar.
 */
async function registrarPagamentoAfiliado(
  admin: AdminClient,
  assinatura: AssinaturaMp,
  parcela: ParcelaMp,
  agora: Date,
  d: DepsMp,
): Promise<void> {
  const pagamentoId = parcela.payment?.id;
  const obraId = assinatura.external_reference ?? "";
  if (pagamentoId === undefined || pagamentoId === null || !UUID_RE.test(obraId)) return;

  const reais = parcela.transaction_amount ?? assinatura.auto_recurring.transaction_amount;
  const valorCentavos = Math.round(Number(reais) * 100);
  if (!Number.isFinite(valorCentavos) || valorCentavos <= 0) return;

  const { data, error } = await admin.rpc("fn_afiliado_registrar_pagamento", {
    p_obra: obraId,
    p_pagamento_id: String(pagamentoId),
    p_valor_centavos: valorCentavos,
    p_agora: agora.toISOString(),
  });
  if (error) {
    // App publicado antes da migration do programa: ninguém tem indicação ainda, nada a registrar.
    if (error.code === "PGRST202" || error.code === "42883") return;
    throw new Error(sanitizarErro(error));
  }

  // Desconto de "primeira fatura": depois do 1º pagamento a assinatura volta ao preço cheio.
  const reverter = (data as { reverter?: { descontoCentavos?: number; alvoCentavos?: number | null } | null } | null)
    ?.reverter;
  if (reverter?.descontoCentavos && reverter.descontoCentavos > 0) {
    await reverterDesconto(
      admin,
      {
        obraId,
        assinatura,
        descontoCentavos: reverter.descontoCentavos,
        alvoCentavos: reverter.alvoCentavos ?? null,
      },
      d.atualizarValorAssinatura,
    );
  }
}

/** Efeitos da notificação sobre a cobrança da obra (registrar, renovar, inadimplência, cancelamento). */
async function tratarCobranca(
  admin: AdminClient,
  logId: string,
  assinatura: AssinaturaMp,
  parcela: ParcelaMp | null,
  agora: Date,
  d: DepsMp,
): Promise<{ ok: boolean; mensagem: string }> {
  const evento = interpretarEstado(assinatura, parcela);
  const cobranca = await localizarCobranca(admin, assinatura.id);

  if (evento.tipo === "ignorado") {
    await marcarProcessado(admin, logId);
    return { ok: true, mensagem: `ignorado: ${evento.motivo}` };
  }

  if (evento.tipo === "cancelada") {
    if (!cobranca) {
      // Cancelada antes de registrada (regularização desfeita, cartão trocado): nada a fazer.
      await marcarProcessado(admin, logId);
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
      await marcarProcessado(admin, logId, "CANCELADA_SEM_PEDIDO");
    } else {
      await marcarProcessado(admin, logId);
    }
    return { ok: true, mensagem: `cobranca: ${resultado}` };
  }

  if (evento.tipo === "falhou") {
    if (!cobranca) {
      await marcarProcessado(admin, logId);
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
    await marcarProcessado(admin, logId);
    return {
      ok: true,
      mensagem: r?.alterada ? "cobranca inadimplente" : "falha ignorada",
    };
  }

  // autorizada ou paga
  if (!cobranca) {
    if (!podeRegistrar(assinatura, agora)) {
      await marcarProcessado(admin, logId);
      return { ok: true, mensagem: "aguardando a primeira cobranca" };
    }
    const r = await registrarCobrancaAssinatura(admin, assinatura, agora);
    if (!r.ok) {
      await marcarProcessado(admin, logId, r.erro, false);
      return { ok: false, mensagem: r.erro };
    }
    await marcarProcessado(admin, logId);
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
    await marcarProcessado(admin, logId);
    return { ok: true, mensagem: alterada ? "cobranca renovada" : "renovacao ignorada" };
  }

  await marcarProcessado(admin, logId);
  return { ok: true, mensagem: "assinatura ja registrada" };
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
    const agora = d.agora();

    // Comissão de afiliado: depende só do pagamento aprovado (não do estado da cobrança, que pode
    // já estar cancelada ou ainda não registrada). Uma falha aqui não pode travar a cobrança: ela
    // é tratada normalmente e só depois o erro sobe, para o provedor reenviar e a comissão (idempotente
    // por pagamento) ser refeita.
    let falhaAfiliado: unknown = null;
    if (parcela && pagamentoAprovado(parcela)) {
      try {
        await registrarPagamentoAfiliado(admin, assinatura, parcela, agora, d);
      } catch (e) {
        falhaAfiliado = e;
      }
    }

    const resultado = await tratarCobranca(admin, c.logId, assinatura, parcela, agora, d);
    if (falhaAfiliado) throw falhaAfiliado;
    return resultado;
  } catch (e) {
    await admin
      .from("webhooks_log")
      .update({ processado: false, erro: sanitizarErro(e) })
      .eq("id", c.logId);
    throw e;
  }
}
