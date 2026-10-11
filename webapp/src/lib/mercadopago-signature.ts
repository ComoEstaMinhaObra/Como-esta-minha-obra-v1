import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida o cabeçalho `x-signature` das notificações do Mercado Pago.
 *
 * Formato do cabeçalho: `ts=<epoch>,v1=<hmac hex>`.
 * Manifest assinado (HMAC-SHA256, chave = segredo do webhook no painel):
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`, em que `data.id` vem da query da URL
 * (minúsculo quando alfanumérico) e partes ausentes saem do manifest.
 * @see https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 *
 * Não confere a idade do `ts`: o provedor reenvia notificações horas depois e a idempotência
 * por estado do recurso (webhook) já neutraliza repetição.
 */
export const MP_SIGNATURE_HEADER = "x-signature";
export const MP_REQUEST_ID_HEADER = "x-request-id";

export function montarManifestMp(
  dataId: string | null,
  requestId: string | null,
  ts: string,
): string {
  let manifest = "";
  if (dataId) {
    const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
    manifest += `id:${id};`;
  }
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;
  return manifest;
}

function lerCabecalho(xSignature: string): { ts: string; v1: string } | null {
  let ts = "";
  let v1 = "";
  for (const parte of xSignature.split(",")) {
    const eq = parte.indexOf("=");
    if (eq === -1) continue;
    const chave = parte.slice(0, eq).trim();
    const valor = parte.slice(eq + 1).trim();
    if (chave === "ts") ts = valor;
    if (chave === "v1") v1 = valor;
  }
  return ts && v1 ? { ts, v1 } : null;
}

export function validarAssinaturaMercadoPago(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { xSignature, xRequestId, dataId, secret } = params;
  if (!xSignature || !secret) return false;
  const cab = lerCabecalho(xSignature);
  if (!cab) return false;

  const esperado = createHmac("sha256", secret)
    .update(montarManifestMp(dataId, xRequestId, cab.ts))
    .digest("hex");

  const a = Buffer.from(esperado);
  const b = Buffer.from(cab.v1.toLowerCase());
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
