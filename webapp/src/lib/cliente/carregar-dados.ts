import "server-only";
import { cache } from "react";

import {
  calcularAvancoGeral,
  calcularFinanceiro,
  calcularNovaDataTermino,
} from "@/lib/relatorios/calculos";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { createClient } from "@/lib/supabase/server";
import { diasDeObra, diasRestantes, hojeIsoBahia } from "@/lib/datas";

export type ClienteObraContexto = {
  obra: {
    id: string;
    nome: string;
    endereco: string;
    clienteNome: string;
    construtora: string | null;
    engenheiro: string | null;
    escritorioArquitetura: string | null;
    arquiteto: string | null;
    projetistaEstruturas: string | null;
    projetistaInstalacoes: string | null;
    inicioContratual: string;
    terminoContratual: string;
    valorContratadoCentavos: number;
    lat: number | null;
    lng: number | null;
  };
  usuario: {
    id: string;
    email: string;
    nome: string;
  };
  temAcesso: boolean;
  semRelatorio: boolean;
  ultimoRelatorio: {
    id: string;
    numero: number;
    enviadoEm: string;
    snapshot: RelatorioSnapshot;
  } | null;
  relatorioAnterior: {
    id: string;
    numero: number;
    enviadoEm: string;
  } | null;
  todosRelatorios: {
    id: string;
    numero: number;
    enviadoEm: string;
  }[];
  etapas: {
    id: string;
    nome: string;
    ordem: number;
    peso: number;
    pctAtual: number;
  }[];
  lancamentos: {
    tipo: string;
    grupo: string;
    rotulo: string;
    valorCentavos: number;
    numero: number | null;
  }[];
  diasAditivados: {
    motivo: string;
    descricao: string | null;
    dias: number;
  }[];
  climaDias: {
    data: string;
    condicao: "aberto" | "nublado" | "chuvoso";
    probChuva: number | null;
  }[];
  fotos: {
    id: string;
    storagePath: string;
    etapaId: string;
    etapaNome: string;
    relatorioId: string;
    relatorioEnviadoEm: string;
    ordem: number;
    urlAssinada: string | null;
  }[];
  agregados: {
    avancoGeral: number;
    pctPago: number;
    contratadoTotalCentavos: number;
    pagoAcumuladoCentavos: number;
    saldoCentavos: number;
    aditivosAcumuladoCentavos: number;
    entregaPrevista: string;
    diasDeObra: number;
    diasRestantes: number;
    totalDiasAditivados: number;
  };
};

export type CarregarClienteResult =
  | { ok: true; dados: ClienteObraContexto }
  | { ok: false; motivo: "nao_autenticado" | "sem_acesso" | "obra_nao_encontrada" };

export const carregarDadosCliente = cache(async function carregarDadosCliente(
  obraId: string,
): Promise<CarregarClienteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, motivo: "nao_autenticado" };
  }

  const { data: temAcesso } = await supabase.rpc("tem_acesso_obra", {
    p_obra: obraId,
  });

  if (!temAcesso) {
    return { ok: false, motivo: "sem_acesso" };
  }

  const { data: obra } = await supabase
    .from("obras")
    .select(
      "id, nome, endereco, cliente_nome, construtora, engenheiro, escritorio_arquitetura, arquiteto, projetista_estruturas, projetista_instalacoes, inicio_contratual, termino_contratual, valor_contratado_centavos, lat, lng, arquivada_em",
    )
    .eq("id", obraId)
    .maybeSingle();

  if (!obra || obra.arquivada_em) {
    return { ok: false, motivo: "obra_nao_encontrada" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .maybeSingle();

  const [
    { data: etapas },
    { data: lancamentos },
    { data: diasAditivos },
    { data: relatorios },
    { data: clima },
    { data: fotosRows },
  ] = await Promise.all([
    supabase
      .from("etapas")
      .select("id, nome, ordem, peso, pct_atual")
      .eq("obra_id", obraId)
      .order("ordem"),
    supabase
      .from("lancamentos")
      .select("tipo, grupo, rotulo, valor_centavos, numero")
      .eq("obra_id", obraId)
      .order("criado_em", { ascending: true }),
    supabase
      .from("dias_aditivados")
      .select("motivo, descricao, dias")
      .eq("obra_id", obraId),
    supabase
      .from("relatorios")
      .select("id, numero, status, enviado_em, snapshot")
      .eq("obra_id", obraId)
      .eq("status", "enviado")
      .order("numero", { ascending: false }),
    supabase
      .from("clima_snapshots")
      .select("data, condicao, prob_chuva")
      .eq("obra_id", obraId)
      .order("data", { ascending: true }),
    supabase
      .from("fotos")
      .select("id, storage_path, etapa_id, relatorio_id, ordem")
      .eq("obra_id", obraId)
      .order("ordem", { ascending: true }),
  ]);

  const listaEtapas = etapas ?? [];
  const avancoGeral = calcularAvancoGeral(
    listaEtapas.map((e) => ({ peso: Number(e.peso), pct: e.pct_atual })),
  );

  const listaLanc = lancamentos ?? [];
  const aditivos = listaLanc
    .filter((l) => l.tipo === "aditivo")
    .map((l) => l.valor_centavos);
  const estornosAditivos = listaLanc
    .filter((l) => l.tipo === "estorno" && l.grupo === "aditivos")
    .map((l) => l.valor_centavos);
  const pago = listaLanc
    .filter((l) =>
      ["sinal", "medicao", "material", "estorno"].includes(l.tipo),
    )
    .filter((l) => !(l.tipo === "estorno" && l.grupo === "aditivos"))
    .map((l) => l.valor_centavos);

  const fin = calcularFinanceiro({
    valorContratadoCentavos: obra.valor_contratado_centavos,
    aditivosCentavos: aditivos,
    pagoCentavos: pago,
    estornosAditivosCentavos: estornosAditivos,
  });

  const diasLista = (diasAditivos ?? []).map((d) => d.dias);
  const totalDiasAditivados = diasLista.reduce((a, b) => a + b, 0);
  const entregaPrevista = calcularNovaDataTermino(
    obra.termino_contratual,
    diasLista,
  );
  const hoje = hojeIsoBahia();

  const enviados = (relatorios ?? []).filter(
    (r) => r.status === "enviado" && r.enviado_em && r.snapshot,
  );

  const ultimo = enviados[0] ?? null;
  const anterior = enviados[1] ?? null;

  let ultimoRelatorio: ClienteObraContexto["ultimoRelatorio"] = null;
  if (ultimo?.snapshot && ultimo.enviado_em) {
    ultimoRelatorio = {
      id: ultimo.id,
      numero: ultimo.numero,
      enviadoEm: ultimo.enviado_em,
      snapshot: ultimo.snapshot as unknown as RelatorioSnapshot,
    };
  }

  const etapaPorId = new Map(listaEtapas.map((e) => [e.id, e.nome]));
  const relatorioPorId = new Map(
    enviados.map((r) => [r.id, r.enviado_em ?? ""]),
  );

  const fotosComUrl: ClienteObraContexto["fotos"] = [];
  for (const f of fotosRows ?? []) {
    const enviadoEm = relatorioPorId.get(f.relatorio_id);
    if (!enviadoEm) continue; // só fotos de relatórios enviados
    const { data: signed } = await supabase.storage
      .from("fotos")
      .createSignedUrl(f.storage_path, 3600);
    fotosComUrl.push({
      id: f.id,
      storagePath: f.storage_path,
      etapaId: f.etapa_id,
      etapaNome: etapaPorId.get(f.etapa_id) ?? "Etapa",
      relatorioId: f.relatorio_id,
      relatorioEnviadoEm: enviadoEm,
      ordem: f.ordem,
      urlAssinada: signed?.signedUrl ?? null,
    });
  }

  // Clima: 7 dias anteriores à data do relatório vigente (ou últimos 7 se sem)
  const climaAll = (clima ?? []).map((c) => ({
    data: c.data,
    condicao: c.condicao,
    probChuva: c.prob_chuva,
  }));
  let climaDias = climaAll;
  if (ultimoRelatorio) {
    const dataRef = ultimoRelatorio.enviadoEm.slice(0, 10);
    climaDias = climaAll.filter((c) => c.data <= dataRef).slice(-7);
  } else {
    climaDias = climaAll.slice(-7);
  }

  return {
    ok: true,
    dados: {
      obra: {
        id: obra.id,
        nome: obra.nome,
        endereco: obra.endereco,
        clienteNome: obra.cliente_nome,
        construtora: obra.construtora,
        engenheiro: obra.engenheiro,
        escritorioArquitetura: obra.escritorio_arquitetura,
        arquiteto: obra.arquiteto,
        projetistaEstruturas: obra.projetista_estruturas,
        projetistaInstalacoes: obra.projetista_instalacoes,
        inicioContratual: obra.inicio_contratual,
        terminoContratual: obra.termino_contratual,
        valorContratadoCentavos: obra.valor_contratado_centavos,
        lat: obra.lat,
        lng: obra.lng,
      },
      usuario: {
        id: user.id,
        email: user.email ?? "",
        nome: profile?.nome?.trim() || user.email?.split("@")[0] || "Proprietário",
      },
      temAcesso: true,
      semRelatorio: !ultimoRelatorio,
      ultimoRelatorio,
      relatorioAnterior: anterior?.enviado_em
        ? {
            id: anterior.id,
            numero: anterior.numero,
            enviadoEm: anterior.enviado_em,
          }
        : null,
      todosRelatorios: enviados
        .filter((r) => r.enviado_em)
        .map((r) => ({
          id: r.id,
          numero: r.numero,
          enviadoEm: r.enviado_em!,
        })),
      etapas: listaEtapas.map((e) => ({
        id: e.id,
        nome: e.nome,
        ordem: e.ordem,
        peso: Number(e.peso),
        pctAtual: e.pct_atual,
      })),
      lancamentos: listaLanc.map((l) => ({
        tipo: l.tipo,
        grupo: l.grupo,
        rotulo: l.rotulo,
        valorCentavos: l.valor_centavos,
        numero: l.numero,
      })),
      diasAditivados: (diasAditivos ?? []).map((d) => ({
        motivo: d.motivo,
        descricao: d.descricao,
        dias: d.dias,
      })),
      climaDias,
      fotos: fotosComUrl,
      agregados: {
        avancoGeral,
        pctPago: fin.pctPago,
        contratadoTotalCentavos: fin.contratadoTotalCentavos,
        pagoAcumuladoCentavos: fin.pagoAcumuladoCentavos,
        saldoCentavos: fin.saldoCentavos,
        aditivosAcumuladoCentavos: fin.aditivosAcumuladoCentavos,
        entregaPrevista,
        diasDeObra: diasDeObra(obra.inicio_contratual, hoje),
        diasRestantes: diasRestantes(entregaPrevista, hoje),
        totalDiasAditivados,
      },
    },
  };
});
