import "server-only";

import { EMAIL_ADICIONAL, OBRA_ATIVA } from "@/config/pricing";
import { logSeguro, sanitizarErro } from "@/lib/log";
import {
  atualizarValorAssinatura,
  consultarAssinatura,
  MercadoPagoError,
  reaisParaCentavos,
} from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Processa um item da outbox do e-mail adicional. No Mercado Pago não há lançamento avulso: o
 * adicional é o valor da própria assinatura da obra. `add` soma R$ 29,90 e `subtract` tira; o
 * novo valor vale daqui em diante, então a renovação não relança nada. O valor já cobrado e a data
 * da próxima cobrança não mudam (spike de 11/10/2026).
 */
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
    const atual = await consultarAssinatura(c.subscriptionId);
    // Só mexe no valor de assinatura viva. Compensar (subtract) aceita assinatura cancelada pelo
    // próprio app, mas aí não há próxima cobrança a corrigir.
    if (atual.status !== "authorized") {
      const compensacaoSemEfeito = c.operacao === "subtract" && atual.status === "cancelled";
      if (!compensacaoSemEfeito) {
        await admin.rpc("fn_falhar_outbox", {
          p_outbox: outboxId,
          p_erro: "ASSINATURA_INATIVA",
          p_incerto: false,
        });
        return { ok: false, erro: "COBRANCA_RECUSADA" };
      }
    }

    const atualCentavos = reaisParaCentavos(atual.auto_recurring.transaction_amount);
    const delta = c.operacao === "add" ? EMAIL_ADICIONAL.precoCentavos : -EMAIL_ADICIONAL.precoCentavos;
    // Nunca abaixo do valor da obra: um valor menor indica divergência, não um e-mail a menos.
    const novoCentavos = Math.max(OBRA_ATIVA.precoCentavos, atualCentavos + delta);
    if (atual.status === "authorized" && novoCentavos !== atualCentavos) {
      await atualizarValorAssinatura(c.subscriptionId, novoCentavos);
    }

    let conf: unknown = null;
    let confErr: { message: string } | null = null;
    for (let tentativa = 0; tentativa < 3; tentativa += 1) {
      const resultado = await admin.rpc("fn_confirmar_outbox", {
        p_outbox: outboxId,
        // Identificador próprio: o Mercado Pago não devolve id de lançamento.
        p_usage_id: `mp:${outboxId}`,
        // Parcela que sai com o valor novo.
        p_installment: (atual.summarized?.charged_quantity ?? 0) + 1,
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
    const status = e instanceof MercadoPagoError ? e.status : 0;
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
