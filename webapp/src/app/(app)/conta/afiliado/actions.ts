"use server";

import { revalidatePath } from "next/cache";
import { normalizarChavePix, type TipoChavePix } from "@/lib/afiliados/pix";
import { enviarEmailSaqueSolicitado } from "@/lib/email/enviar";
import { logSeguro, sanitizarErro } from "@/lib/log";
import { codigoRpc } from "@/lib/rpc-erros";
import { createClient } from "@/lib/supabase/server";

const TIPOS: TipoChavePix[] = ["cpf", "cnpj", "email", "telefone", "aleatoria"];

/** Pede o saque de todo o saldo disponível. O suporte paga o Pix e confirma no admin. */
export async function solicitarSaque(tipo: TipoChavePix, chave: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };
  if (!TIPOS.includes(tipo)) return { ok: false as const, erro: "CHAVE_PIX_INVALIDA" };

  // O banco confere só o formato; o dígito verificador de CPF/CNPJ é conferido aqui.
  const normalizada = normalizarChavePix(tipo, chave);
  if (!normalizada.ok) return { ok: false as const, erro: "CHAVE_PIX_INVALIDA" };

  const { data, error } = await supabase.rpc("fn_afiliado_solicitar_saque", {
    p_tipo_chave: tipo,
    p_chave: normalizada.chave,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const valorCentavos = (data as { valorCentavos?: number } | null)?.valorCentavos ?? 0;

  // Aviso ao suporte; falha de e-mail só vai para o log, o pedido já está registrado.
  try {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", user.id)
      .maybeSingle();
    await enviarEmailSaqueSolicitado({ afiliadoNome: perfil?.nome ?? "", valorCentavos });
  } catch (e) {
    logSeguro("error", { evento: "email_saque_solicitado" });
    void sanitizarErro(e);
  }

  revalidatePath("/conta/afiliado");
  return { ok: true as const, valorCentavos };
}
