import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { enviarEmailPagamentoPendente } from "@/lib/email/enviar";
import { logSeguro, sanitizarErro } from "@/lib/log";

export interface ResultadoJobCobranca {
  novasInadimplentes: number;
  emailsEnviados: number;
  canceladasPorFimDoPeriodo: number;
  canceladasPorInadimplencia: number;
}

interface RetornoJob {
  novasInadimplentes: Array<{ cobrancaId: string; userId: string; obraId: string }>;
  canceladasPorFimDoPeriodo: number;
  canceladasPorInadimplencia: number;
}

/** Prazo de recuperação do pagamento (decisões, seção 2.6). */
export const DIAS_RECUPERACAO = 14;

function ddmm(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/**
 * Job diário da cobrança por obra: marca inadimplentes (período vencido sem renovação), encerra
 * cancelamentos cujo período pago terminou e cancela inadimplência de mais de 14 dias. Avisa por
 * e-mail o dono de cada obra que acabou de ficar inadimplente.
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

  const limite = ddmm(new Date(agora.getTime() + DIAS_RECUPERACAO * 86400000));
  let emailsEnviados = 0;

  for (const n of r.novasInadimplentes) {
    try {
      const { data: obra } = await admin
        .from("obras")
        .select("nome")
        .eq("id", n.obraId)
        .maybeSingle();
      const { data: usuario } = await admin.auth.admin.getUserById(n.userId);
      const email = usuario?.user?.email;
      if (!email) continue;
      await enviarEmailPagamentoPendente({
        para: email,
        obraNome: obra?.nome || "sua obra",
        limite,
      });
      emailsEnviados += 1;
    } catch {
      logSeguro("error", {
        evento: "email_pagamento_pendente",
        ids: { obraId: n.obraId },
      });
    }
  }

  return {
    novasInadimplentes: r.novasInadimplentes.length,
    emailsEnviados,
    canceladasPorFimDoPeriodo: r.canceladasPorFimDoPeriodo,
    canceladasPorInadimplencia: r.canceladasPorInadimplencia,
  };
}
