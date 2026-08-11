/**
 * Client tipado AbacatePay v2 (server-only).
 * Endpoints e campos conforme docs.abacatepay.com — sem campos inventados.
 */
import "server-only";
import { getServerEnv } from "@/config/env";
import type { PlanoId } from "@/config/pricing";
import { planoPorId } from "@/config/pricing";

export {
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
}

export interface AssinaturaCheckout {
  id: string;
  url: string;
  externalId?: string | null;
  amount: number;
  status: string;
  customerId?: string | null;
}

export interface TrocarPlanoInput {
  id: string;
  productId: string;
  quantity: number;
}

export interface TrocarPlanoResult {
  id: string;
  subscriptionId: string;
  status: string;
  productId: string;
  quantity: number;
  newAmount: number;
  requestedAt: string;
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
  const env = getServerEnv();
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
    console.error("[abacatepay]", msg, { status: res.status, body: parsed });
    throw new AbacatePayError(msg, res.status, parsed);
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

/** POST /subscriptions/change-plan */
export async function trocarPlano(
  input: TrocarPlanoInput,
): Promise<TrocarPlanoResult> {
  return request<TrocarPlanoResult>("POST", "/subscriptions/change-plan", input);
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

export function produtoIdDoPlano(planoId: PlanoId): string {
  const env = getServerEnv();
  switch (planoId) {
    case "obra_1":
      return env.ABACATEPAY_PROD_OBRA_1;
    case "obra_3":
      return env.ABACATEPAY_PROD_OBRA_3;
    case "obra_5":
      return env.ABACATEPAY_PROD_OBRA_5;
    default: {
      const _exhaustive: never = planoId;
      throw new Error(`Plano sem produto: ${_exhaustive}`);
    }
  }
}

export function planoPorProdutoId(produtoId: string): PlanoId | null {
  const env = getServerEnv();
  if (produtoId === env.ABACATEPAY_PROD_OBRA_1) return "obra_1";
  if (produtoId === env.ABACATEPAY_PROD_OBRA_3) return "obra_3";
  if (produtoId === env.ABACATEPAY_PROD_OBRA_5) return "obra_5";
  return null;
}

export function limiteDoPlano(planoId: PlanoId): number {
  return planoPorId(planoId).limiteObras;
}

export function produtoEmailExtraId(): string {
  return getServerEnv().ABACATEPAY_PROD_EMAIL_EXTRA;
}
