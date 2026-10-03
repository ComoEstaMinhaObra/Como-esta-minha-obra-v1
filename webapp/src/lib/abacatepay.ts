/**
 * Client tipado AbacatePay v2 (server-only).
 * Endpoints e campos conforme docs.abacatepay.com — sem campos inventados.
 */
import "server-only";
import { getCobrancaEnv } from "@/config/env";
import { OBRA_ATIVA } from "@/config/pricing";

export {
  ABACATEPAY_PUBLIC_KEY,
  validateWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/lib/abacatepay-signature";

const BASE_URL = "https://api.abacatepay.com/v2";

export class AbacatePayError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "AbacatePayError";
  }
}

type Envelope<T> = {
  data: T;
  success: boolean;
  error: string | null;
};

export type ProductCycle =
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "SEMIANNUALLY"
  | "ANNUALLY";

export interface AbacateProduct {
  id: string;
  externalId: string;
  name: string;
  description?: string;
  price: number;
  currency: "BRL";
  cycle: ProductCycle | null;
  status: "ACTIVE" | "INACTIVE";
  devMode: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AbacateCustomer {
  id: string;
  email: string;
  name?: string;
  cellphone?: string;
  taxId?: string;
  zipCode?: string;
  country?: string;
  devMode: boolean;
  metadata?: Record<string, unknown>;
}

export interface CriarProdutoInput {
  externalId: string;
  name: string;
  price: number;
  currency: "BRL";
  cycle?: ProductCycle;
  description?: string;
  /** Dias até a primeira cobrança; o checkout cobra R$ 0,00 e só guarda o cartão. */
  trialDays?: number;
}

export interface CriarClienteInput {
  email: string;
  name?: string;
  cellphone?: string;
  taxId?: string;
  zipCode?: string;
  metadata?: Record<string, unknown>;
}

export interface CriarAssinaturaInput {
  items: Array<{ id: string; quantity: number }>;
  customerId?: string;
  externalId?: string;
  methods?: Array<"CARD" | "PIX">;
  returnUrl?: string;
  completionUrl?: string;
  metadata?: Record<string, unknown>;
  /** Tentativas após falha (maxRetry 1-10, retryEvery 1-30 dias). 7 x 2 = 14 dias de recuperação. */
  retryPolicy?: { maxRetry: number; retryEvery: number };
}

export interface AssinaturaCheckout {
  id: string;
  url: string;
  externalId?: string | null;
  amount: number;
  status: string;
  customerId?: string | null;
}

export interface RegistrarUsoInput {
  id: string;
  productId: string;
  units: number;
  action: "add" | "subtract";
}

export interface RegistrarUsoResult {
  id: string;
  subscriptionId: string;
  productId: string;
  units: number;
  unitPrice: number;
  action: "add" | "subtract";
  installmentNumber: number;
  recordedAt: string;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const env = getCobrancaEnv();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.ABACATEPAY_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  let parsed: Envelope<T> | null = null;
  try {
    parsed = (await res.json()) as Envelope<T>;
  } catch {
    parsed = null;
  }

  if (!res.ok || !parsed?.success) {
    const msg =
      parsed?.error ??
      `AbacatePay ${method} ${path} falhou com HTTP ${res.status}`;
    console.error("[abacatepay]", { status: res.status, path });
    throw new AbacatePayError(msg, res.status, { status: res.status });
  }

  return parsed.data;
}

/** POST /products/create */
export async function criarProduto(
  input: CriarProdutoInput,
): Promise<AbacateProduct> {
  return request<AbacateProduct>("POST", "/products/create", input);
}

/**
 * POST /customers/create
 * Nota: o plano §5.4 lista `/client/create` (path da doc); OpenAPI oficial usa `/customers/create`.
 */
export async function criarCliente(
  input: CriarClienteInput,
): Promise<AbacateCustomer> {
  return request<AbacateCustomer>("POST", "/customers/create", input);
}

/** POST /subscriptions/create → checkout com data.url */
export async function criarAssinatura(
  input: CriarAssinaturaInput,
): Promise<AssinaturaCheckout> {
  return request<AssinaturaCheckout>("POST", "/subscriptions/create", input);
}

/** POST /subscriptions/record-usage */
export async function registrarUso(
  input: RegistrarUsoInput,
): Promise<RegistrarUsoResult> {
  return request<RegistrarUsoResult>(
    "POST",
    "/subscriptions/record-usage",
    input,
  );
}

export interface AbacateAssinatura {
  id: string;
  checkoutId?: string | null;
  customerId?: string | null;
  amount: number;
  status: string;
  trialDays?: number | null;
  /** Fim do período de teste do produto com trialDays; é quando ocorre a primeira cobrança. */
  trialEndsAt?: string | null;
  createdAt?: string;
}

/**
 * GET /subscriptions/list e procura pelo id. O payload dos webhooks não traz a data do fim do
 * trial, só esta consulta (spike E0, 03/10/2026). Primeira página (limit 100) basta por ora.
 */
export async function consultarAssinatura(
  id: string,
): Promise<AbacateAssinatura | null> {
  const lista = await request<AbacateAssinatura[]>(
    "GET",
    "/subscriptions/list?limit=100",
  );
  return (lista ?? []).find((s) => s.id === id) ?? null;
}

/** Política de novas tentativas da cobrança: 7 tentativas a cada 2 dias = 14 dias de recuperação. */
export const RETRY_POLICY_OBRA = { maxRetry: 7, retryEvery: 2 } as const;

/**
 * Produto da obra com a primeira cobrança adiada em `dias` dias (regra Q1: obra nova durante o
 * período já pago de uma obra arquivada). Criado sob demanda e reaproveitado pelo externalId.
 * A API ignora o filtro externalId da listagem, então lista e filtra aqui.
 */
export async function garantirProdutoObraComTrial(dias: number): Promise<string> {
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    throw new Error("DIAS_TRIAL_INVALIDOS");
  }
  const externalId = `${OBRA_ATIVA.externalId}-td${dias}`;
  const existentes = await listarProdutos({ limit: 100 });
  const achado = (existentes ?? []).find((p) => p.externalId === externalId);
  if (achado) return achado.id;
  const criado = await criarProduto({
    externalId,
    name: `Como Esta Minha Obra — ${OBRA_ATIVA.nome} (primeira cobrança em ${dias} dias)`,
    price: OBRA_ATIVA.precoCentavos,
    currency: "BRL",
    cycle: "MONTHLY",
    trialDays: dias,
  });
  return criado.id;
}

/** POST /subscriptions/cancel */
export async function cancelarAssinatura(id: string): Promise<unknown> {
  return request("POST", "/subscriptions/cancel", { id });
}

/** GET /products/list — usado no bootstrap idempotente (S4.2). */
export async function listarProdutos(params?: {
  externalId?: string;
  limit?: number;
}): Promise<AbacateProduct[]> {
  const qs = new URLSearchParams();
  if (params?.externalId) qs.set("externalId", params.externalId);
  if (params?.limit) qs.set("limit", String(params.limit));
  const suffix = qs.size > 0 ? `?${qs.toString()}` : "";
  return request<AbacateProduct[]>("GET", `/products/list${suffix}`);
}

export function produtoEmailExtraId(): string {
  return getCobrancaEnv().ABACATEPAY_PROD_EMAIL_EXTRA;
}
