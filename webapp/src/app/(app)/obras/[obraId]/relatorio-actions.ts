"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { podeEditarRascunho } from "@/lib/gating";
import type { AssinaturaStatus } from "@/lib/gating";
import type { Json } from "@/lib/database.types";
import type { RelatorioRascunho } from "@/lib/relatorios/tipos";

function rascunhoComoJson(dados: RelatorioRascunho): Json {
  return dados as unknown as Json;
}

export async function obterProximoNumeroRelatorio(obraId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("relatorios")
    .select("numero")
    .eq("obra_id", obraId)
    .order("numero", { ascending: false })
    .limit(1);
  return (data?.[0]?.numero ?? 0) + 1;
}

export async function salvarRascunhoRelatorio(params: {
  obraId: string;
  relatorioId?: string;
  numero: number;
  dados: RelatorioRascunho;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: obra } = await supabase
    .from("obras")
    .select("id, owner_id, arquivada_em")
    .eq("id", params.obraId)
    .maybeSingle();
  if (!obra || obra.owner_id !== user.id || obra.arquivada_em) {
    return { ok: false as const, erro: "SEM_PERMISSAO" };
  }

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("status, limite_obras, trial_fim, relatorios_enviados_trial")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    !podeEditarRascunho({
      status: (assinatura?.status ?? "trial") as AssinaturaStatus,
      limiteObras: assinatura?.limite_obras ?? 1,
      obrasAtivas: 0,
      trialFim: assinatura?.trial_fim ? new Date(assinatura.trial_fim) : null,
      relatoriosEnviadosTrial: assinatura?.relatorios_enviados_trial ?? 0,
    })
  ) {
    return { ok: false as const, erro: "ASSINATURA_INATIVA" };
  }

  if (params.relatorioId) {
    const { error } = await supabase
      .from("relatorios")
      .update({
        dados_rascunho: rascunhoComoJson(params.dados),
        status: "rascunho",
      })
      .eq("id", params.relatorioId)
      .eq("obra_id", params.obraId)
      .eq("status", "rascunho");
    if (error) return { ok: false as const, erro: error.message };
    revalidatePath(`/obras/${params.obraId}`);
    return { ok: true as const, relatorioId: params.relatorioId, numero: params.numero };
  }

  const { data, error } = await supabase
    .from("relatorios")
    .insert({
      obra_id: params.obraId,
      numero: params.numero,
      status: "rascunho",
      dados_rascunho: rascunhoComoJson(params.dados),
    })
    .select("id, numero")
    .single();

  if (error) return { ok: false as const, erro: error.message };

  revalidatePath(`/obras/${params.obraId}`);
  return {
    ok: true as const,
    relatorioId: data.id,
    numero: data.numero,
  };
}

export async function carregarRascunho(relatorioId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("relatorios")
    .select("id, obra_id, numero, status, dados_rascunho")
    .eq("id", relatorioId)
    .eq("status", "rascunho")
    .maybeSingle();
  if (error || !data) return { ok: false as const, erro: "AUSENTE" };
  return {
    ok: true as const,
    relatorio: data,
  };
}
