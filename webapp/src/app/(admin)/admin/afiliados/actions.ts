"use server";

import { revalidatePath } from "next/cache";
import type { DuracaoDesconto } from "@/lib/afiliados/formatar";
import { enviarEmailSaqueResolvido } from "@/lib/email/enviar";
import { logSeguro, sanitizarErro } from "@/lib/log";
import { codigoRpc } from "@/lib/rpc-erros";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Toda mutação confere is_admin() dentro da própria RPC; aqui só exige sessão.
async function sessao() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export interface DadosLink {
  codigo: string;
  rotulo: string;
  comissaoBps: number;
  vitalicia: boolean;
  descontoBps: number;
  descontoDuracao: DuracaoDesconto | null;
}

const inteiro = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

function dadosLinkValidos(d: DadosLink): boolean {
  return (
    inteiro(d.comissaoBps) &&
    inteiro(d.descontoBps) &&
    typeof d.vitalicia === "boolean" &&
    (d.descontoDuracao === null ||
      d.descontoDuracao === "primeira_fatura" ||
      d.descontoDuracao === "permanente")
  );
}

export async function buscarUsuarioAction(email: string) {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  const { data, error } = await supabase.rpc("fn_admin_buscar_usuario", { p_email: email });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  const r = data as { encontrado: boolean; id?: string; nome?: string; email?: string };
  if (!r.encontrado || !r.id) return { ok: true as const, encontrado: false as const };
  return {
    ok: true as const,
    encontrado: true as const,
    id: r.id,
    nome: r.nome ?? "",
    email: r.email ?? email,
  };
}

export async function criarLinkAction(afiliadoId: string, dados: DadosLink) {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  if (!dadosLinkValidos(dados)) return { ok: false as const, erro: "DADOS_INVALIDOS" };

  const { error } = await supabase.rpc("fn_admin_afiliado_criar_link", {
    p_afiliado: afiliadoId,
    p_codigo: dados.codigo,
    p_rotulo: dados.rotulo,
    p_comissao_bps: dados.comissaoBps,
    p_vitalicia: dados.vitalicia,
    p_desconto_bps: dados.descontoBps,
    p_desconto_duracao: dados.descontoDuracao as string,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  revalidatePath("/admin/afiliados");
  return { ok: true as const };
}

export async function atualizarLinkAction(linkId: string, dados: Omit<DadosLink, "codigo">, ativo: boolean) {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  if (!dadosLinkValidos({ ...dados, codigo: "" }) || typeof ativo !== "boolean") {
    return { ok: false as const, erro: "DADOS_INVALIDOS" };
  }

  const { error } = await supabase.rpc("fn_admin_afiliado_atualizar_link", {
    p_link: linkId,
    p_rotulo: dados.rotulo,
    p_comissao_bps: dados.comissaoBps,
    p_vitalicia: dados.vitalicia,
    p_desconto_bps: dados.descontoBps,
    p_desconto_duracao: dados.descontoDuracao as string,
    p_ativo: ativo,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  revalidatePath("/admin/afiliados");
  return { ok: true as const };
}

export async function salvarConfigAction(carenciaDias: number, saqueMinimoCentavos: number) {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  if (!inteiro(carenciaDias) || !inteiro(saqueMinimoCentavos)) {
    return { ok: false as const, erro: "CONFIG_INVALIDA" };
  }
  const { error } = await supabase.rpc("fn_admin_afiliado_config_salvar", {
    p_carencia_dias: carenciaDias,
    p_saque_minimo_centavos: saqueMinimoCentavos,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  revalidatePath("/admin/afiliados");
  return { ok: true as const };
}

export async function estornarComissaoAction(lancamentoId: string, motivo: string) {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  const { data, error } = await supabase.rpc("fn_admin_afiliado_estornar", {
    p_lancamento: lancamentoId,
    p_motivo: motivo,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  revalidatePath("/admin/afiliados/comissoes");
  revalidatePath("/admin/afiliados");
  return { ok: true as const, alterada: Boolean((data as { alterada?: boolean })?.alterada) };
}

type RetornoSaque = { alterada?: boolean; afiliadoId?: string; valorCentavos?: number };

/** Avisa o afiliado do desfecho do saque. Falha de e-mail só vai para o log: o saque já foi resolvido. */
async function avisarSaque(
  r: RetornoSaque,
  situacao: "pago" | "recusado",
  observacao: string,
) {
  if (!r.alterada || !r.afiliadoId || !r.valorCentavos) return;
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(r.afiliadoId);
    const email = data?.user?.email;
    if (!email) return;
    await enviarEmailSaqueResolvido({
      para: email,
      situacao,
      valorCentavos: r.valorCentavos,
      observacao: observacao.trim() || null,
    });
  } catch (e) {
    logSeguro("error", { evento: "email_saque_afiliado" });
    void sanitizarErro(e);
  }
}

export async function pagarSaqueAction(saqueId: string, observacao: string) {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  const { data, error } = await supabase.rpc("fn_admin_saque_pagar", {
    p_saque: saqueId,
    p_obs: observacao,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  await avisarSaque(data as RetornoSaque, "pago", observacao);
  revalidatePath("/admin/afiliados/saques");
  revalidatePath("/admin/afiliados");
  return { ok: true as const };
}

export async function recusarSaqueAction(saqueId: string, motivo: string) {
  const { supabase, user } = await sessao();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  const { data, error } = await supabase.rpc("fn_admin_saque_recusar", {
    p_saque: saqueId,
    p_motivo: motivo,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  await avisarSaque(data as RetornoSaque, "recusado", motivo);
  revalidatePath("/admin/afiliados/saques");
  revalidatePath("/admin/afiliados");
  return { ok: true as const };
}
