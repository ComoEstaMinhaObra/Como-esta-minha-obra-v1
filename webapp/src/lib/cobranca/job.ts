import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { DIAS_RECUPERACAO } from "@/lib/cobranca/constantes";
import { enviarEmailPagamentoPendente } from "@/lib/email/enviar";
import { logSeguro, sanitizarErro } from "@/lib/log";
import { cancelarAssinatura } from "@/lib/mercadopago";

export interface ResultadoJobCobranca {
  novasInadimplentes: number;
  emailsEnviados: number;
  canceladasPorFimDoPeriodo: number;
  canceladasPorInadimplencia: number;
  /** Assinaturas encerradas no Mercado Pago após a inadimplência de 14 dias. */
  canceladasNoProvedor: number;
}

interface RetornoJob {
  novasInadimplentes: Array<{ cobrancaId: string; userId: string; obraId: string }>;
  canceladasPorFimDoPeriodo: number;
  canceladasPorInadimplencia: number;
  assinaturasCanceladasPorInadimplencia?: string[];
}

function ddmm(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Avisa por e-mail o dono da obra que o pagamento ficou pendente. Falha de e-mail só vai para o log. */
export async function avisarPagamentoPendente(
  admin: SupabaseClient<Database>,
  params: { userId: string; obraId: string; agora: Date },
): Promise<boolean> {
  try {
    const { data: obra } = await admin
      .from("obras")
      .select("nome")
      .eq("id", params.obraId)
      .maybeSingle();
    const { data: usuario } = await admin.auth.admin.getUserById(params.userId);
    const email = usuario?.user?.email;
    if (!email) return false;
    await enviarEmailPagamentoPendente({
      para: email,
      obraNome: obra?.nome || "sua obra",
      limite: ddmm(new Date(params.agora.getTime() + DIAS_RECUPERACAO * 86400000)),
    });
    return true;
  } catch {
    logSeguro("error", {
      evento: "email_pagamento_pendente",
      ids: { obraId: params.obraId },
    });
    return false;
  }
}

/**
 * Job diário da cobrança por obra: marca inadimplentes (período vencido sem renovação), encerra
 * cancelamentos cujo período pago terminou e cancela inadimplência de mais de 14 dias, e então
 * cancela essas assinaturas no Mercado Pago (que só tenta cobrar por 10 dias e não cancela sozinho).
 * Avisa por e-mail o dono de cada obra que acabou de ficar inadimplente.
 */
export async function executarJobCobranca(
  admin: SupabaseClient<Database>,
  agora: Date = new Date(),
): Promise<ResultadoJobCobranca> {
  const { data, error } = await admin.rpc("fn_cobranca_job_diario", {
    p_agora: agora.toISOString(),
  });
  if (error) throw new Error(sanitizarErro(error));
  const r = data as unknown as RetornoJob;

  let emailsEnviados = 0;
  for (const n of r.novasInadimplentes) {
    if (await avisarPagamentoPendente(admin, { userId: n.userId, obraId: n.obraId, agora })) {
      emailsEnviados += 1;
    }
  }

  // A cobrança já está cancelada no banco; encerra a assinatura no provedor, com 3 tentativas
  // (o cancelamento é idempotente). Falha não derruba o job, mas deixa a assinatura autorizada lá:
  // o erro vai para o log para o admin cancelar no painel do Mercado Pago.
  let canceladasNoProvedor = 0;
  for (const subId of r.assinaturasCanceladasPorInadimplencia ?? []) {
    let cancelada = false;
    for (let tentativa = 0; tentativa < 3 && !cancelada; tentativa += 1) {
      try {
        await cancelarAssinatura(subId);
        cancelada = true;
      } catch {
        /* tenta de novo */
      }
    }
    if (cancelada) canceladasNoProvedor += 1;
    else logSeguro("error", { evento: "job_cancelar_inadimplente_no_provedor", status: "falhou" });
  }

  return {
    novasInadimplentes: r.novasInadimplentes.length,
    emailsEnviados,
    canceladasPorFimDoPeriodo: r.canceladasPorFimDoPeriodo,
    canceladasPorInadimplencia: r.canceladasPorInadimplencia,
    canceladasNoProvedor,
  };
}
