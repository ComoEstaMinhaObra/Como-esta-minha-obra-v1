import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Chave pública AbacatePay para HMAC dos webhooks.
 * Fonte: https://docs.abacatepay.com/pages/webhooks (seção de segurança).
 */
export const ABACATEPAY_PUBLIC_KEY =
  "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";

/**
 * Valida assinatura HMAC-SHA256 do webhook AbacatePay.
 *
 * Header: `X-Webhook-Signature`
 * Digest: base64 (HMAC-SHA256) com a chave pública oficial — comparação timing-safe.
 * @see https://docs.abacatepay.com/pages/webhooks
 */
export function validateWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  publicKey: string = ABACATEPAY_PUBLIC_KEY,
): boolean {
  if (!signatureHeader || !publicKey) return false;

  const expected = createHmac("sha256", publicKey)
    .update(Buffer.from(rawBody, "utf8"))
    .digest("base64");

  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader.trim());
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const WEBHOOK_SIGNATURE_HEADER = "x-webhook-signature";
