"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import type { RelatorioRascunho } from "@/lib/relatorios/tipos";
import { codigoRpc } from "@/lib/rpc-erros";

function rascunhoComoJson(dados: RelatorioRascunho): Json {
  return dados as unknown as Json;
}

export async function salvarRascunhoRelatorio(params: {
  obraId: string;
  relatorioId?: string;
  numero?: number;
  dados: RelatorioRascunho;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data, error } = await supabase.rpc("fn_salvar_rascunho", {
    p_obra: params.obraId,
    p_relatorio: (params.relatorioId ?? null) as string,
    p_dados: rascunhoComoJson(params.dados),
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const r = data as { relatorioId: string; numero: number };
  revalidatePath(`/obras/${params.obraId}`);
  return { ok: true as const, relatorioId: r.relatorioId, numero: r.numero };
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
  return { ok: true as const, relatorio: data };
}

export async function reservarFotoAction(params: {
  obraId: string;
  relatorioId: string;
  etapaId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_reservar_foto", {
    p_obra: params.obraId,
    p_relatorio: params.relatorioId,
    p_etapa: params.etapaId,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };
  const r = data as { storagePath: string };
  return { ok: true as const, storagePath: r.storagePath };
}
