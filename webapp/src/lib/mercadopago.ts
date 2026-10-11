/**
 * Client tipado do Mercado Pago (assinaturas sem plano, `/preapproval`), server-only.
 * Comportamentos confirmados com a API real no spike de 11/10/2026 (scripts/spike-mercadopago.ts).
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { getMercadoPagoEnv } from "@/config/env";

const BASE_URL = "https://api.mercadopago.com";

export class MercadoPagoError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo?: string,
  ) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

/**
 * Cartão recusado na contratação (HTTP 400, `code: rejected`, mensagem `CC_VAL_…`) ou na troca de
 * cartão (HTTP 402). Confirmado no spike de 11/10/2026: nenhuma assinatura é criada.
 */
export function cartaoRecusado(e: unknown): boolean {
  if (!(e instanceof MercadoPagoError)) return false;
  return (
    e.status === 402 ||
    (e.status === 400 && (e.codigo === "rejected" || e.message.startsWith("CC_VAL")))
  );
}

/** O Mercado Pago trabalha em reais decimais; o app, em centavos inteiros. */
export function centavosParaReais(centavos: number): number {
  if (!Number.isInteger(centavos) || centavos <= 0) {
    throw new Error("VALOR_INVALIDO");
  }
  return Number((centavos / 100).toFixed(2));
}

export function reaisParaCentavos(reais: number): number {
  if (!Number.isFinite(reais) || reais <= 0) throw new Error("VALOR_INVALIDO");
  return Math.round(reais * 100);
}

export type StatusAssinaturaMp =
  | "pending"
  | "authorized"
  | "paused"
  | "cancelled";

export interface AssinaturaMp {
  id: string;
  status: StatusAssinaturaMp;
  external_reference?: string | null;
  payer_email?: string;
  payer_id?: number;
  reason?: string;
  /** Checkout hospedado (fluxo pendente); o app usa o formulário próprio, mas a API devolve. */
  init_point?: string;
  /** Próxima cobrança; vira o fim do período pago / a primeira cobrança adiada. */
  next_payment_date?: string | null;
  date_created?: string;
  last_modified?: string;
  /** Cobranças já feitas; `charged_quantity >= 1` significa que a 1ª parcela foi paga. */
  summarized?: {
    charged_quantity?: number | null;
    charged_amount?: number | null;
    last_charged_date?: string | null;
    semaphore?: string | null;
  } | null;
  auto_recurring: {
    frequency: number;
    frequency_type: "days" | "months";
    transaction_amount: number;
    currency_id: string;
    start_date?: string;
    end_date?: string;
    free_trial?: { frequency: number; frequency_type: "days" | "months" };
  };
}

export interface ParcelaMp {
  id: number | string;
  preapproval_id: string;
  status: string;
  /** Resultado da tentativa de cobrança: `approved` / `accredited` quando paga. */
  payment?: { id?: number; status?: string; status_detail?: string };
  transaction_amount?: number;
  debit_date?: string;
  retry_attempt?: number;
  date_created?: string;
  last_modified?: string;
}

async function request<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
  chaveIdempotencia?: string,
): Promise<T> {
  const env = getMercadoPagoEnv();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    headers["X-Idempotency-Key"] = chaveIdempotencia ?? randomUUID();
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const corpo = (parsed ?? {}) as { message?: string; error?: string; code?: string };
    const msg =
      corpo.message ?? corpo.error ?? `Mercado Pago ${method} ${path} falhou com HTTP ${res.status}`;
    // Status, caminho e código vão para o log; a mensagem só fora de produção, porque o corpo
    // pode ecoar o e-mail do pagador.
    console.error("[mercadopago]", {
      status: res.status,
      path: path.split("?")[0],
      codigo: corpo.code ?? corpo.error,
      ...(process.env.NODE_ENV !== "production" ? { mensagem: msg } : {}),
    });
    throw new MercadoPagoError(msg, res.status, corpo.code ?? corpo.error);
  }
  return parsed as T;
}

export interface CriarAssinaturaInput {
  /** Id da obra: volta nas notificações como `external_reference`. */
  obraId: string;
  payerEmail: string;
  valorCentavos: number;
  /** Texto exibido ao pagador no extrato/checkout. */
  motivo: string;
  /** Obrigatória e só https é aceito (localhost é recusado); não é usada, pois o cartão é pago no app. */
  backUrl: string;
  /** Token do cartão gerado no navegador (formulário do app). Com ele a assinatura nasce autorizada. */
  cardTokenId?: string;
  /** Primeira cobrança adiada em N dias (regra Q1): `free_trial` em dias, sem cobrança até lá. */
  primeiraCobrancaEmDias?: number;
  chaveIdempotencia?: string;
}

/** POST /preapproval */
export async function criarAssinatura(
  input: CriarAssinaturaInput,
): Promise<AssinaturaMp> {
  const autorizada = Boolean(input.cardTokenId);
  const body = {
    reason: input.motivo,
    external_reference: input.obraId,
    payer_email: input.payerEmail,
    back_url: input.backUrl,
    status: autorizada ? "authorized" : "pending",
    ...(input.cardTokenId ? { card_token_id: input.cardTokenId } : {}),
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: centavosParaReais(input.valorCentavos),
      currency_id: "BRL",
      ...(input.primeiraCobrancaEmDias
        ? {
            free_trial: {
              frequency: input.primeiraCobrancaEmDias,
              frequency_type: "days",
            },
          }
        : {}),
    },
  };
  return request<AssinaturaMp>("POST", "/preapproval", body, input.chaveIdempotencia);
}

/** GET /preapproval/{id} */
export async function consultarAssinatura(id: string): Promise<AssinaturaMp> {
  return request<AssinaturaMp>("GET", `/preapproval/${encodeURIComponent(id)}`);
}

/** GET /authorized_payments/{id}: cada cobrança (parcela) de uma assinatura. */
export async function consultarParcela(id: string): Promise<ParcelaMp> {
  return request<ParcelaMp>("GET", `/authorized_payments/${encodeURIComponent(id)}`);
}

/**
 * PUT /preapproval/{id} com status cancelled. Efeito imediato e definitivo (spike de 11/10/2026).
 * Idempotente: cancelar de novo devolve HTTP 400, e nesse caso a assinatura já cancelada vale como sucesso.
 */
export async function cancelarAssinatura(id: string): Promise<AssinaturaMp> {
  try {
    return await request<AssinaturaMp>(
      "PUT",
      `/preapproval/${encodeURIComponent(id)}`,
      { status: "cancelled" },
      `cancelar-${id}`,
    );
  } catch (e) {
    if (e instanceof MercadoPagoError && e.status === 400) {
      const atual = await consultarAssinatura(id).catch(() => null);
      if (atual?.status === "cancelled") return atual;
    }
    throw e;
  }
}

/**
 * Altera o valor das próximas cobranças (e-mail adicional). Não mexe no que já foi cobrado nem na
 * data da próxima cobrança (spike de 11/10/2026); a próxima parcela com o valor novo é conferida
 * na Staging.
 * A chave de idempotência inclui o valor para que repetir a mesma alteração seja inofensivo.
 */
export async function atualizarValorAssinatura(
  id: string,
  valorCentavos: number,
): Promise<AssinaturaMp> {
  return request<AssinaturaMp>(
    "PUT",
    `/preapproval/${encodeURIComponent(id)}`,
    {
      auto_recurring: {
        transaction_amount: centavosParaReais(valorCentavos),
        currency_id: "BRL",
      },
    },
    `valor-${id}-${valorCentavos}`,
  );
}

/** PUT /preapproval/{id} com novo card_token_id. Cartão recusado devolve 402 e mantém o antigo. */
export async function trocarCartaoAssinatura(
  id: string,
  cardTokenId: string,
): Promise<AssinaturaMp> {
  return request<AssinaturaMp>("PUT", `/preapproval/${encodeURIComponent(id)}`, {
    card_token_id: cardTokenId,
  });
}
