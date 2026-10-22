import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { logSeguro, sanitizarErro } from "@/lib/log";
import type { AssinaturaMp } from "@/lib/mercadopago";
import type { DuracaoDesconto } from "./formatar";

type AdminClient = SupabaseClient<Database>;

export interface DescontoObra {
  descontoCentavos: number;
  descontoBps: number;
  duracao: DuracaoDesconto | null;
}

export const SEM_DESCONTO: DescontoObra = { descontoCentavos: 0, descontoBps: 0, duracao: null };

/**
 * Função ausente no banco (app publicado antes da migration): o programa ainda não existe, então
 * ninguém tem desconto. Qualquer outro erro sobe: cobrar o preço errado é pior que falhar.
 */
function funcaoAusente(error: { code?: string } | null): boolean {
  return error?.code === "PGRST202" || error?.code === "42883";
}

/**
 * Desconto da obra para o indicado (0 se não houver). `reservar` trava o desconto de "primeira
 * fatura" nesta obra; a prévia (sem reservar) alimenta a tela de cobrança. O preço de tabela vem
 * do app; o banco só faz a conta.
 */
export async function descontoDaObra(
  admin: AdminClient,
  userId: string,
  obraId: string,
  precoCentavos: number,
  reservar: boolean,
): Promise<DescontoObra> {
  const { data, error } = await admin.rpc("fn_afiliado_desconto_obra", {
    p_user: userId,
    p_obra: obraId,
    p_preco_centavos: precoCentavos,
    p_reservar: reservar,
  });
  if (error) {
    if (funcaoAusente(error)) return SEM_DESCONTO;
    throw new Error(sanitizarErro(error));
  }
  const r = data as { descontoCentavos?: number; descontoBps?: number; duracao?: DuracaoDesconto | null } | null;
  const centavos = r?.descontoCentavos ?? 0;
  // Resposta fora do esperado nunca vira preço: sem desconto é o lado seguro.
  if (!Number.isInteger(centavos) || centavos <= 0 || centavos >= precoCentavos) return SEM_DESCONTO;
  return { descontoCentavos: centavos, descontoBps: r?.descontoBps ?? 0, duracao: r?.duracao ?? null };
}

/** Devolve a reserva quando a assinatura não chegou a ser criada. Falha só vai para o log. */
export async function liberarDescontoDaObra(
  admin: AdminClient,
  userId: string,
  obraId: string,
): Promise<void> {
  try {
    const { error } = await admin.rpc("fn_afiliado_desconto_liberar", {
      p_user: userId,
      p_obra: obraId,
    });
    if (error && !funcaoAusente(error)) throw error;
  } catch (e) {
    logSeguro("error", { evento: "afiliado_desconto_liberar", ids: { obraId } });
    void sanitizarErro(e);
  }
}

/** Desconto em vigor numa assinatura registrada (centavos), para o piso do valor com e-mail extra. */
export async function descontoDaAssinatura(
  admin: AdminClient,
  subscriptionId: string,
  precoCentavos: number,
): Promise<number> {
  const { data, error } = await admin.rpc("fn_afiliado_desconto_assinatura", {
    p_subscription_id: subscriptionId,
    p_preco_centavos: precoCentavos,
  });
  if (error) {
    if (funcaoAusente(error)) return 0;
    throw new Error(sanitizarErro(error));
  }
  return typeof data === "number" && Number.isInteger(data) && data > 0 && data < precoCentavos
    ? data
    : 0;
}

/**
 * Devolve a assinatura ao preço cheio depois do 1º pagamento do desconto de "primeira fatura".
 * O valor-alvo é gravado antes de chamar o provedor: repetir (retry do webhook, job diário) manda
 * sempre o mesmo valor, nunca soma o desconto duas vezes. Assinatura cancelada não tem próxima
 * cobrança a corrigir; pendente/pausada fica para a próxima tentativa.
 */
export async function reverterDesconto(
  admin: AdminClient,
  params: {
    obraId: string;
    assinatura: AssinaturaMp;
    descontoCentavos: number;
    alvoCentavos?: number | null;
  },
  atualizarValor: (id: string, valorCentavos: number) => Promise<unknown>,
): Promise<boolean> {
  const { obraId, assinatura } = params;
  if (assinatura.status !== "authorized" && assinatura.status !== "cancelled") return false;

  if (assinatura.status === "authorized") {
    let alvo = params.alvoCentavos ?? null;
    if (!alvo) {
      const atual = Math.round(Number(assinatura.auto_recurring.transaction_amount) * 100);
      const { data, error } = await admin.rpc("fn_afiliado_desconto_reversao_alvo", {
        p_obra: obraId,
        p_alvo_centavos: atual + params.descontoCentavos,
      });
      if (error) throw new Error(sanitizarErro(error));
      alvo = Number(data);
    }
    if (!Number.isInteger(alvo) || alvo <= 0) throw new Error("ALVO_INVALIDO");
    await atualizarValor(assinatura.id, alvo);
  }

  let ultimoErro: unknown = null;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const { error } = await admin.rpc("fn_afiliado_desconto_revertido", { p_obra: obraId });
    ultimoErro = error;
    if (!error) return true;
  }
  throw new Error(sanitizarErro(ultimoErro));
}
