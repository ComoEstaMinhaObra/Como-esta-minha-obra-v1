import "server-only";

import {
  AbacatePayError,
  produtoEmailExtraId,
  registrarUso,
} from "@/lib/abacatepay";
import { logSeguro, sanitizarErro } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processarOutbox(outboxId: string): Promise<{
  ok: boolean;
  enviarEmail?: boolean;
  email?: string;
  obraId?: string;
  erro?: string;
}> {
  const admin = createAdminClient();
  const { data: claim, error: claimErr } = await admin.rpc("fn_claim_outbox", {
    p_outbox: outboxId,
  });
  if (claimErr) {
    return { ok: false, erro: sanitizarErro(claimErr) };
  }
  const c = claim as {
    status?: string;
    idempotente?: boolean;
    repetirProvedor?: boolean;
    operacao?: "add" | "subtract";
    subscriptionId?: string | null;
    assinaturaId?: string;
    obraId?: string;
  };
  if (c.status === "confirmado") return { ok: true };
  if (c.status === "incerto" || c.repetirProvedor === false) {
    return { ok: false, erro: "COBRANCA_INCERTA" };
  }
  if (c.status !== "processando" || !c.subscriptionId || !c.operacao) {
    return { ok: false, erro: "OUTBOX_INVALIDO" };
  }

  try {
    const uso = await registrarUso({
      id: c.subscriptionId,
      productId: produtoEmailExtraId(),
      units: 1,
      action: c.operacao,
    });
    let conf: unknown = null;
    let confErr: { message: string } | null = null;
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const resultado = await admin.rpc("fn_confirmar_outbox", {
        p_outbox: outboxId,
        p_usage_id: uso.id,
        p_installment: uso.installmentNumber,
      });
      conf = resultado.data;
      confErr = resultado.error;
      if (!confErr) break;
    }
    if (confErr) {
      await admin.rpc("fn_falhar_outbox", {
        p_outbox: outboxId,
        p_erro: sanitizarErro(confErr),
        p_incerto: true,
      });
      logSeguro("error", {
        evento: "outbox_confirm_local",
        status: "db",
        ids: { outboxId },
      });
      return { ok: false, erro: sanitizarErro(confErr) };
    }
    const r = conf as { enviarEmail?: boolean; email?: string };
    return {
      ok: true,
      enviarEmail: r.enviarEmail,
      email: r.email,
      obraId: c.obraId,
    };
  } catch (e) {
    const status = e instanceof AbacatePayError ? e.status : 0;
    const incerto = status === 0 || status >= 500;
    const retry429 = status === 429;
    if (retry429) {
      await admin.rpc("fn_reagendar_outbox", {
        p_outbox: outboxId,
        p_erro: sanitizarErro(e),
      });
    } else {
      await admin.rpc("fn_falhar_outbox", {
        p_outbox: outboxId,
        p_erro: sanitizarErro(e),
        p_incerto: incerto,
      });
    }
    logSeguro("error", {
      evento: "outbox_provedor",
      status,
      ids: { outboxId },
    });
    if (retry429) return { ok: false, erro: "RATE_LIMITED" };
    if (incerto) return { ok: false, erro: "COBRANCA_INCERTA" };
    return { ok: false, erro: "COBRANCA_RECUSADA" };
  }
}
