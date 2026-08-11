import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import {
  validateWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/lib/abacatepay-signature";
import {
  gravarWebhookLog,
  marcarWebhookProcessado,
  processarEventoAssinatura,
  type WebhookPayload,
} from "@/lib/abacatepay-webhook";
import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const env = getServerEnv();
  const rawBody = await request.text();

  // Camada 1 (docs): secret na query ?webhookSecret=
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("webhookSecret");
  if (querySecret !== env.ABACATEPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ erro: "secret invalido" }, { status: 401 });
  }

  // Camada 2: HMAC-SHA256 (chave pública) no header X-Webhook-Signature
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

  const evento = payload.event ?? "desconhecido";
  const admin = createAdminClient();

  let logId: string;
  try {
    logId = await gravarWebhookLog(
      admin,
      evento,
      payload as Json,
      false,
      null,
    );
  } catch (e) {
    console.error("[webhook:abacatepay] falha ao gravar log", e);
    return NextResponse.json({ erro: "falha ao gravar log" }, { status: 500 });
  }

  try {
    const result = await processarEventoAssinatura(admin, payload);
    await marcarWebhookProcessado(admin, logId, true, null);
    return NextResponse.json({
      ok: result.ok,
      mensagem: result.mensagem,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[webhook:abacatepay] processamento", msg);
    await marcarWebhookProcessado(admin, logId, false, msg);
    return NextResponse.json({ ok: false, erro: msg });
  }
}
