"use server";

import { createClient } from "@/lib/supabase/server";
import { ETAPAS_PADRAO } from "@/lib/obras/etapas";
import { geocodificarEndereco } from "@/lib/clima/geocode";
import { sincronizarClimaObra } from "@/lib/clima/sincronizar";

export type NovaObraInput = {
  nome: string;
  endereco: string;
  clienteNome: string;
  construtora?: string;
  engenheiro?: string;
  escritorioArquitetura?: string;
  arquiteto?: string;
  projetistaEstruturas?: string;
  projetistaInstalacoes?: string;
  inicioContratual: string;
  terminoContratual: string;
  valorContratadoCentavos: number;
  sinalCentavos: number;
  etapas: { nome: string; peso: number }[];
  lat?: number | null;
  lng?: number | null;
};

export async function criarObraAction(input: NovaObraInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false as const, erro: "NAO_AUTENTICADO" };
  }

  const etapas =
    input.etapas.length > 0
      ? input.etapas
      : ETAPAS_PADRAO.map((nome) => ({ nome, peso: 1 }));

  let lat = input.lat ?? null;
  let lng = input.lng ?? null;
  let avisoClima: string | undefined;

  if (lat == null || lng == null) {
    const geo = await geocodificarEndereco(input.endereco);
    if (geo) {
      lat = geo.lat;
      lng = geo.lng;
    } else {
      avisoClima = "clima indisponível para este endereço";
    }
  }

  const { data, error } = await supabase.rpc("fn_criar_obra", {
    p_nome: input.nome,
    p_endereco: input.endereco,
    p_cliente_nome: input.clienteNome,
    p_inicio: input.inicioContratual,
    p_termino: input.terminoContratual,
    p_valor_centavos: input.valorContratadoCentavos,
    p_sinal_centavos: input.sinalCentavos,
    p_lat: lat ?? undefined,
    p_lng: lng ?? undefined,
    p_construtora: input.construtora || undefined,
    p_engenheiro: input.engenheiro || undefined,
    p_escritorio_arquitetura: input.escritorioArquitetura || undefined,
    p_arquiteto: input.arquiteto || undefined,
    p_projetista_estruturas: input.projetistaEstruturas || undefined,
    p_projetista_instalacoes: input.projetistaInstalacoes || undefined,
    p_etapas: etapas,
  });

  if (error) {
    if (error.message.includes("LIMITE_OBRAS")) {
      return { ok: false as const, erro: "LIMITE_OBRAS" };
    }
    return { ok: false as const, erro: error.message };
  }

  const obraId = data as string;

  // Fire-and-forget: população inicial de clima_snapshots
  if (lat != null && lng != null) {
    void sincronizarClimaObra(obraId, lat, lng).catch((err) => {
      console.error("[clima] sync inicial falhou", obraId, err);
    });
  }

  return {
    ok: true as const,
    obraId,
    ...(avisoClima ? { avisoClima } : {}),
  };
}

export async function atualizarCapaObra(obraId: string, path: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("obras")
    .update({ foto_capa_path: path })
    .eq("id", obraId);
  if (error) return { ok: false as const, erro: error.message };
  return { ok: true as const };
}
