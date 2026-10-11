"use server";

import { revalidatePath } from "next/cache";
import { publicEnv } from "@/config/env";
import { OBRA_ATIVA } from "@/config/pricing";
import { registrarCobrancaAssinatura } from "@/lib/cobranca/mercadopago-webhook";
import { logSeguro, sanitizarErro } from "@/lib/log";
import {
  cancelarAssinatura,
  cartaoRecusado,
  criarAssinatura,
  type AssinaturaMp,
} from "@/lib/mercadopago";
import { codigoRpc } from "@/lib/rpc-erros";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type ErroContratar =
  | "NAO_AUTENTICADO"
  | "RATE_LIMITED"
  | "SEM_PERMISSAO"
  | "OBRA_ARQUIVADA"
  | "JA_CONTRATADA"
  | "REATIVAR_APOS"
  | "CARTAO_OBRIGATORIO"
  | "CARTAO_RECUSADO"
  | "FALHA_CHECKOUT";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

/**
 * Cria a assinatura da obra no Mercado Pago com o cartão tokenizado no navegador. O cartão é
 * validado na criação: recusado devolve erro na hora e nada é criado (spike de 11/10/2026).
 * Com período pago aproveitável (obra arquivada, regra Q1) a primeira cobrança é adiada
 * (`free_trial` em dias); sem ele a primeira parcela é cobrada na hora.
 */
async function criarAssinaturaDaObra(
  supabase: SupabaseServer,
  email: string,
  obraId: string,
  cardTokenId: string,
): Promise<
  { ok: true; assinatura: AssinaturaMp } | { ok: false; erro: ErroContratar }
> {
  try {
    const { data: vaga } = await supabase.rpc("fn_vaga_paga_disponivel");
    const v = vaga as { disponivel?: boolean; dias?: number } | null;
    const dias = v?.disponivel && v.dias && v.dias >= 1 ? Math.floor(v.dias) : undefined;

    const appUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    const assinatura = await criarAssinatura({
      obraId,
      payerEmail: email,
      valorCentavos: OBRA_ATIVA.precoCentavos,
      motivo: "Como Está Minha Obra — obra ativa",
      // O provedor exige uma URL https mesmo sem usá-la; em dev local (http) vale o site público.
      backUrl: appUrl.startsWith("https://")
        ? `${appUrl}/cobranca`
        : "https://www.comoestaminhaobra.com.br/cobranca",
      cardTokenId,
      primeiraCobrancaEmDias: dias,
      // O token do cartão é de uso único: repetir o envio não cria uma segunda assinatura.
      chaveIdempotencia: `obra-${obraId}-${cardTokenId}`,
    });
    return { ok: true, assinatura };
  } catch (e) {
    if (cartaoRecusado(e)) return { ok: false, erro: "CARTAO_RECUSADO" };
    logSeguro("error", { evento: "checkout_obra", ids: { obraId } });
    void sanitizarErro(e);
    return { ok: false, erro: "FALHA_CHECKOUT" };
  }
}

/**
 * Grava a cobrança logo depois da criação. Se falhar, a assinatura já existe no provedor e o
 * webhook registra em seguida (mesma função, idempotente); a tela fica em "confirmando".
 */
async function registrarAposCriar(
  assinatura: AssinaturaMp,
  obraId: string,
): Promise<boolean> {
  try {
    const r = await registrarCobrancaAssinatura(createAdminClient(), assinatura);
    return r.ok;
  } catch (e) {
    logSeguro("error", { evento: "registrar_cobranca", ids: { obraId } });
    void sanitizarErro(e);
    return false;
  }
}

/**
 * Contrata a assinatura de UMA obra (R$ 129,90 por mês) com o cartão informado. O `external_reference`
 * da assinatura é o id da obra: o webhook localiza a obra por ele.
 */
export async function contratarObra(obraId: string, cardTokenId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, erro: "NAO_AUTENTICADO" as const };
  if (!cardTokenId) return { ok: false as const, erro: "CARTAO_OBRIGATORIO" as const };

  const { error: rlErr } = await supabase.rpc("fn_consumir_rate_limit", {
    p_acao: "checkout",
  });
  if (rlErr) return { ok: false as const, erro: "RATE_LIMITED" as const };

  const { data: obra } = await supabase
    .from("obras")
    .select("id, owner_id, arquivada_em")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id) {
    return { ok: false as const, erro: "SEM_PERMISSAO" as const };
  }
  if (obra.arquivada_em) {
    return { ok: false as const, erro: "OBRA_ARQUIVADA" as const };
  }

  // Cobrança não cancelada da obra: ativa/inadimplente já está contratada; cancelamento
  // agendado só reativa depois de acesso_ate (decisão D4).
  const { data: existente } = await supabase
    .from("cobrancas_obra")
    .select("status, acesso_ate")
    .eq("obra_id", obraId)
    .neq("status", "cancelada")
    .maybeSingle();
  if (existente) {
    if (
      existente.status === "cancelamento_agendado" &&
      existente.acesso_ate &&
      new Date(existente.acesso_ate) > new Date()
    ) {
      return {
        ok: false as const,
        erro: "REATIVAR_APOS" as const,
        acessoAte: existente.acesso_ate,
      };
    }
    if (existente.status !== "cancelamento_agendado") {
      return { ok: false as const, erro: "JA_CONTRATADA" as const };
    }
  }

  const { data: conta } = await supabase
    .from("assinaturas")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conta) return { ok: false as const, erro: "SEM_PERMISSAO" as const };

  const criada = await criarAssinaturaDaObra(supabase, user.email, obraId, cardTokenId);
  if (!criada.ok) return { ok: false as const, erro: criada.erro };

  const registrada = await registrarAposCriar(criada.assinatura, obraId);
  revalidatePath("/cobranca");
  revalidatePath("/obras");
  return { ok: true as const, obraId, confirmando: !registrada };
}

export interface ResultadoCancelamento {
  obraId: string;
  ok: boolean;
  erro?: string;
  acessoAte?: string;
}

/**
 * Cancela a cobrança de uma ou mais obras. Grava a intenção ANTES de chamar o provedor (que
 * cancela na hora) e desfaz se o provedor falhar. A obra mantém os recursos até o fim do período
 * já pago (acesso_ate).
 */
export async function cancelarCobrancas(obraIds: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const resultados: ResultadoCancelamento[] = [];
  for (const obraId of [...new Set(obraIds)].slice(0, 20)) {
    const { data, error } = await supabase.rpc("fn_cobranca_solicitar_cancelamento", {
      p_obra: obraId,
    });
    if (error) {
      resultados.push({ obraId, ok: false, erro: codigoRpc(error) });
      continue;
    }
    const r = data as { subscriptionId: string; acessoAte: string };
    try {
      await cancelarAssinatura(r.subscriptionId);
      resultados.push({ obraId, ok: true, acessoAte: r.acessoAte });
    } catch (e) {
      logSeguro("error", { evento: "cancelar_cobranca", ids: { obraId } });
      void sanitizarErro(e);
      await supabase.rpc("fn_cobranca_desfazer_cancelamento", { p_obra: obraId });
      resultados.push({ obraId, ok: false, erro: "FALHA_PROVEDOR" });
    }
  }

  revalidatePath("/cobranca");
  revalidatePath("/obras");
  return { ok: true as const, resultados };
}

export type ErroRegularizar =
  | ErroContratar
  | "COBRANCA_NAO_REGULARIZAVEL"
  | "FALHA_PROVEDOR"
  | "FALHA_CONCLUIR";

/**
 * Regulariza o pagamento pendente de uma obra com um cartão novo. A ordem protege o usuário:
 * 1) grava a intenção; 2) cria a assinatura nova (o cartão é validado e cobrado aqui: se for
 * recusado, nada muda e a obra segue como estava); 3) encerra a assinatura com falha; 4) conclui
 * localmente e registra a nova. Falha no passo 3 desfaz o passo 2 antes de a intenção ser desfeita.
 */
export async function regularizarPagamento(obraId: string, cardTokenId?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false as const, erro: "NAO_AUTENTICADO" as const };
  if (!cardTokenId) return { ok: false as const, erro: "CARTAO_OBRIGATORIO" as const };

  const { data, error } = await supabase.rpc("fn_cobranca_solicitar_regularizacao", {
    p_obra: obraId,
  });
  if (error) {
    const codigo = codigoRpc(error);
    return {
      ok: false as const,
      erro: (codigo === "COBRANCA_NAO_REGULARIZAVEL"
        ? codigo
        : "FALHA_PROVEDOR") as ErroRegularizar,
    };
  }
  const { subscriptionId } = data as { subscriptionId: string };

  const criada = await criarAssinaturaDaObra(supabase, user.email, obraId, cardTokenId);
  if (!criada.ok) {
    await supabase.rpc("fn_cobranca_desfazer_regularizacao", { p_obra: obraId });
    return { ok: false as const, erro: criada.erro as ErroRegularizar };
  }

  try {
    await cancelarAssinatura(subscriptionId);
  } catch (e) {
    logSeguro("error", { evento: "regularizar_cancelar", ids: { obraId } });
    void sanitizarErro(e);
    // Desfaz a assinatura nova (acabou de ser cobrada; o estorno é manual) e a intenção.
    await cancelarAssinatura(criada.assinatura.id).catch(() => {
      logSeguro("error", { evento: "regularizar_desfazer_nova", ids: { obraId } });
    });
    await supabase.rpc("fn_cobranca_desfazer_regularizacao", { p_obra: obraId });
    return { ok: false as const, erro: "FALHA_PROVEDOR" as ErroRegularizar };
  }

  let errConcluir: unknown = null;
  for (let tentativa = 0; tentativa < 3; tentativa += 1) {
    const r = await supabase.rpc("fn_cobranca_concluir_regularizacao", { p_obra: obraId });
    errConcluir = r.error;
    if (!errConcluir) break;
  }
  if (errConcluir) {
    // As duas assinaturas já foram trocadas no provedor; o webhook da nova registra quando a
    // regularização concluir. O erro vai para o log para o admin acompanhar.
    logSeguro("error", { evento: "regularizar_concluir", ids: { obraId } });
    revalidatePath("/cobranca");
    return { ok: false as const, erro: "FALHA_CONCLUIR" as ErroRegularizar };
  }

  const registrada = await registrarAposCriar(criada.assinatura, obraId);
  revalidatePath("/cobranca");
  revalidatePath("/obras");
  return { ok: true as const, obraId, confirmando: !registrada };
}
