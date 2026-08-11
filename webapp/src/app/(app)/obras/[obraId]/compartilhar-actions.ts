"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { podeAdicionarEmailExtra } from "@/lib/gating";
import type { AssinaturaStatus } from "@/lib/gating";

export async function listarAcessosObra(obraId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obra_acessos")
    .select("id, email, status, cobrado_extra, user_id, criado_em")
    .eq("obra_id", obraId)
    .order("criado_em", { ascending: true });
  if (error) return { ok: false as const, erro: error.message, acessos: [] };
  return { ok: true as const, acessos: data ?? [] };
}

export async function liberarAcessoObra(obraId: string, email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm.includes("@")) {
    return { ok: false as const, erro: "EMAIL_INVALIDO" };
  }

  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome, owner_id, arquivada_em")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id || obra.arquivada_em) {
    return { ok: false as const, erro: "SEM_PERMISSAO" };
  }

  const { data: existentes } = await supabase
    .from("obra_acessos")
    .select("id, email")
    .eq("obra_id", obraId);

  if ((existentes ?? []).some((a) => a.email.toLowerCase() === emailNorm)) {
    return { ok: false as const, erro: "EMAIL_DUPLICADO" };
  }

  const cobradoExtra = (existentes?.length ?? 0) >= 1;

  if (cobradoExtra) {
    const { data: assinatura } = await supabase
      .from("assinaturas")
      .select("status, limite_obras, trial_fim, relatorios_enviados_trial")
      .eq("user_id", user.id)
      .maybeSingle();

    const pode = podeAdicionarEmailExtra({
      status: (assinatura?.status ?? "trial") as AssinaturaStatus,
      limiteObras: assinatura?.limite_obras ?? 1,
      obrasAtivas: 0,
      trialFim: assinatura?.trial_fim ? new Date(assinatura.trial_fim) : null,
      relatoriosEnviadosTrial: assinatura?.relatorios_enviados_trial ?? 0,
    });

    if (!pode) {
      return { ok: false as const, erro: "PRECISA_ASSINAR" };
    }
  }

  const { error } = await supabase.from("obra_acessos").insert({
    obra_id: obraId,
    email: emailNorm,
    status: "convidado",
    cobrado_extra: cobradoExtra,
  });

  if (error) return { ok: false as const, erro: error.message };

  // E-mail de convite (S2.10): falha não bloqueia o acesso
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .maybeSingle();

  try {
    const { enviarEmailConvite } = await import("@/lib/email/enviar");
    await enviarEmailConvite({
      para: emailNorm,
      empreiteiro: profile?.nome || user.email || "Empreiteiro",
      obraNome: obra.nome,
    });
  } catch (e) {
    console.error("[email:convite] falha", e);
  }

  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const, cobradoExtra };
}

export async function removerAcessoObra(obraId: string, acessoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: obra } = await supabase
    .from("obras")
    .select("id, owner_id")
    .eq("id", obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id) {
    return { ok: false as const, erro: "SEM_PERMISSAO" };
  }

  // Algoritmo add-on completo (record-usage) em S4.5; v1 remove a linha.
  const { error } = await supabase
    .from("obra_acessos")
    .delete()
    .eq("id", acessoId)
    .eq("obra_id", obraId);

  if (error) return { ok: false as const, erro: error.message };

  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const };
}
