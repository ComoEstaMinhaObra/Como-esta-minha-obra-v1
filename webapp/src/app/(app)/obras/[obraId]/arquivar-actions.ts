"use server";

import { revalidatePath } from "next/cache";
import { AbacatePayError, cancelarAssinatura } from "@/lib/abacatepay";
import { logSeguro, sanitizarErro } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";
import { processarOutbox } from "@/lib/outbox";
import { codigoRpc } from "@/lib/rpc-erros";

/**
 * Arquiva a obra. Se ela tem cobrança ativa, encerra a renovação (cancelamento no AbacatePay) e
 * mantém os recursos até o fim do período já pago; o período aproveitável pode ser usado por uma
 * obra nova (regra Q1). Sem devolução proporcional.
 */
export async function arquivarObraAction(obraId: string, nomeConfirmacao: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  // Confere o nome ANTES de mexer na cobrança: um erro de digitação não pode cancelar a
  // assinatura e deixar a obra sem arquivar.
  const { data: obra } = await supabase
    .from("obras")
    .select("nome, owner_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id) {
    return { ok: false as const, erro: "SEM_PERMISSAO" };
  }
  if (nomeConfirmacao.trim() !== obra.nome) {
    return { ok: false as const, erro: "NOME_NAO_CONFERE" };
  }

  let acessoAte: string | null = null;
  const { data: ativa } = await supabase
    .from("cobrancas_obra")
    .select("id")
    .eq("obra_id", obraId)
    .eq("status", "ativa")
    .maybeSingle();
  if (ativa) {
    const { data, error } = await supabase.rpc("fn_cobranca_solicitar_cancelamento", {
      p_obra: obraId,
    });
    if (error) return { ok: false as const, erro: codigoRpc(error) };
    const r = data as { subscriptionId: string; acessoAte: string };
    try {
      await cancelarAssinatura(r.subscriptionId);
      acessoAte = r.acessoAte;
    } catch (e) {
      logSeguro("error", { evento: "arquivar_cancelar_cobranca", ids: { obraId } });
      void (e instanceof AbacatePayError ? sanitizarErro(e) : null);
      await supabase.rpc("fn_cobranca_desfazer_cancelamento", { p_obra: obraId });
      return { ok: false as const, erro: "COBRANCA_NAO_CANCELADA" };
    }
  }

  const { data, error } = await supabase.rpc("fn_arquivar_obra", {
    p_obra: obraId,
    p_nome: nomeConfirmacao,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const r = data as { outboxIds?: string[] };
  for (const id of r.outboxIds ?? []) {
    await processarOutbox(id);
  }

  revalidatePath("/obras");
  revalidatePath("/cobranca");
  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const, acessoAte };
}
