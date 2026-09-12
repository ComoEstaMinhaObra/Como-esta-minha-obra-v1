import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import {
  validateWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/lib/abacatepay-signature";
import {
  processarEventoAssinatura,
  type WebhookPayload,
} from "@/lib/abacatepay-webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { logSeguro, sanitizarErro } from "@/lib/log";

export async function POST(request: Request) {
  const env = getServerEnv();
  const rawBody = await request.text();

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("webhookSecret");
  if (querySecret !== env.ABACATEPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: "secret invalido" }, { status: 401 });
  }

  const signature =
    request.headers.get(WEBHOOK_SIGNATURE_HEADER) ??
    request.headers.get("X-Webhook-Signature");

  if (!validateWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ erro: "assinatura invalida" }, { status: 401 });
  }

  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch {
    return NextResponse.json({ erro: "json invalido" }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    const result = await processarEventoAssinatura(admin, payload);
    return NextResponse.json({
      ok: result.ok,
      mensagem: result.mensagem,
    });
  } catch (e) {
    logSeguro("error", { evento: "webhook_abacatepay", status: "erro" });
    return NextResponse.json(
      { ok: false, erro: sanitizarErro(e) },
      { status: 500 },
    );
  }
}
