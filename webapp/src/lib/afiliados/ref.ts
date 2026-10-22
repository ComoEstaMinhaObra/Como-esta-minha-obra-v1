import "server-only";
import { cookies } from "next/headers";
import { logSeguro } from "@/lib/log";
import { createAdminClient } from "@/lib/supabase/admin";
import { COOKIE_REF, normalizarCodigo } from "./codigo";
import type { DuracaoDesconto } from "./formatar";

export interface RefCadastro {
  codigo: string;
  descontoBps: number;
  descontoDuracao: DuracaoDesconto | null;
}

/**
 * Link de afiliado guardado no cookie, se ainda for válido (ativo). Só a tela de cadastro usa:
 * a decisão de atribuir é do banco; aqui é para mostrar o desconto e enviar o `ref` no signUp.
 * Qualquer falha devolve `null`: o cadastro nunca depende disto.
 */
export async function carregarRefDoCookie(): Promise<RefCadastro | null> {
  const codigo = normalizarCodigo((await cookies()).get(COOKIE_REF)?.value);
  if (!codigo) return null;

  try {
    const { data, error } = await createAdminClient().rpc("fn_afiliado_link_publico", {
      p_codigo: codigo,
    });
    if (error) throw error;
    const link = data as {
      valido?: boolean;
      descontoBps?: number;
      descontoDuracao?: DuracaoDesconto | null;
    } | null;
    if (!link?.valido) return null;
    return {
      codigo,
      descontoBps: link.descontoBps ?? 0,
      descontoDuracao: link.descontoDuracao ?? null,
    };
  } catch {
    logSeguro("error", { evento: "afiliado_link_publico" });
    return null;
  }
}
