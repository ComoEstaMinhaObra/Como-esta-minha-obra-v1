import { NextResponse } from "next/server";
import { getMercadoPagoEnv } from "@/config/env";
import { processarNotificacaoMp } from "@/lib/cobranca/mercadopago-webhook";
import { logSeguro, sanitizarErro } from "@/lib/log";
import {
  MP_REQUEST_ID_HEADER,
  MP_SIGNATURE_HEADER,
  validarAssinaturaMercadoPago,
} from "@/lib/mercadopago-signature";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Webhook do Mercado Pago. A notificação traz só o tipo e o id do recurso; o estado vem de uma
 * consulta à API (src/lib/cobranca/mercadopago-webhook.ts). Resposta 200 mesmo para tipos que o
 * app ignora; 5xx só para falha transitória, para o provedor reenviar.
 */
export async function POST(request: Request) {
  const env = getMercadoPagoEnv();
  const url = new URL(request.url);
  const rawBody = await request.text();

  let corpo: { type?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    corpo = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ erro: "json invalido" }, { status: 400 });
  }

  // O `data.id` assinado é o da query da URL; o do corpo serve de reserva.
  const dataId = url.searchParams.get("data.id") ?? (corpo.data?.id ? String(corpo.data.id) : null);

  const valida = validarAssinaturaMercadoPago({
    xSignature: request.headers.get(MP_SIGNATURE_HEADER),
    xRequestId: request.headers.get(MP_REQUEST_ID_HEADER),
    dataId,
    secret: env.MERCADOPAGO_WEBHOOK_SECRET,
  });
  if (!valida) {
    return NextResponse.json({ erro: "assinatura invalida" }, { status: 401 });
  }

  const tipo = corpo.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
  if (!dataId || !tipo) {
    return NextResponse.json({ ok: true, mensagem: "notificacao sem tipo ou id" });
  }

  try {
    const resultado = await processarNotificacaoMp(createAdminClient(), {
      tipo,
      dataId,
      acao: corpo.action,
    });
    return NextResponse.json({ ok: resultado.ok, mensagem: resultado.mensagem });
  } catch (e) {
    logSeguro("error", { evento: "webhook_mercadopago", status: "erro" });
    return NextResponse.json({ ok: false, erro: sanitizarErro(e) }, { status: 500 });
  }
}
