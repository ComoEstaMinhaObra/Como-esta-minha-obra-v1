import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Valida assinatura HMAC-SHA256 do webhook AbacatePay.
 *
 * Header esperado: `X-Webhook-Signature`
 * (docs.abacatepay.com/pages/webhooks/security e /pages/webhooks).
 *
 * Digest: hex (HMAC-SHA256) com `ABACATEPAY_WEBHOOK_SECRET`, comparação timing-safe.
 * Ver PROGRESS.md → Bloqueios sobre divergência docs (chave pública + base64).
 */
export function validateWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signatureHeader.trim(), "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const WEBHOOK_SIGNATURE_HEADER = "x-webhook-signature";
