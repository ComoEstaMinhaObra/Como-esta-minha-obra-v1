import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logSeguro, sanitizarErro } from "@/lib/log";
import { atualizarValorAssinatura, consultarAssinatura } from "@/lib/mercadopago";
import { reverterDesconto } from "./desconto";

export interface ResultadoReversaoDescontos {
  revertidos: number;
  aguardando: number;
  falhas: number;
}

/**
 * Rede de segurança do job diário: devolve ao preço cheio as assinaturas com desconto de "primeira
 * fatura" cuja reversão não aconteceu no webhook. Só reverte depois de o provedor confirmar que a
 * 1ª cobrança aconteceu (charged_quantity >= 1). Sequencial e limitado: o provedor responde 429 a
 * consultas em rajada.
 */
export async function executarReversaoDescontos(
  admin: SupabaseClient<Database>,
  deps = { consultarAssinatura, atualizarValorAssinatura },
): Promise<ResultadoReversaoDescontos> {
  const { data, error } = await admin.rpc("fn_afiliado_descontos_a_reverter", { p_limite: 20 });
  if (error) {
    // Migration ainda não aplicada: nada a fazer.
    if (error.code === "PGRST202" || error.code === "42883") {
      return { revertidos: 0, aguardando: 0, falhas: 0 };
    }
    throw new Error(sanitizarErro(error));
  }

  const itens = (data ?? []) as unknown as {
    obraId: string;
    subscriptionId: string;
    descontoCentavos: number;
    alvoCentavos: number | null;
  }[];

  const resultado: ResultadoReversaoDescontos = { revertidos: 0, aguardando: 0, falhas: 0 };
  for (const item of itens) {
    try {
      const assinatura = await deps.consultarAssinatura(item.subscriptionId);
      const cobrou = (assinatura.summarized?.charged_quantity ?? 0) >= 1;
      if (assinatura.status === "authorized" && !cobrou) {
        resultado.aguardando += 1;
        continue;
      }
      const feito = await reverterDesconto(
        admin,
        {
          obraId: item.obraId,
          assinatura,
          descontoCentavos: item.descontoCentavos,
          alvoCentavos: item.alvoCentavos,
        },
        deps.atualizarValorAssinatura,
      );
      if (feito) resultado.revertidos += 1;
      else resultado.aguardando += 1;
    } catch (e) {
      resultado.falhas += 1;
      logSeguro("error", { evento: "afiliado_reversao_desconto", ids: { obraId: item.obraId } });
      void sanitizarErro(e);
    }
  }
  return resultado;
}
