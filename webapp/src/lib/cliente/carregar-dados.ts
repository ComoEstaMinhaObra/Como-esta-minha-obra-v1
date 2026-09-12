import "server-only";
import { cache } from "react";

import {
  calcularAvancoGeral,
  calcularFinanceiro,
  calcularNovaDataTermino,
} from "@/lib/relatorios/calculos";
import { montarSnapshotRelatorioEmMemoria } from "@/lib/relatorios/montar-snapshot";
import type {
  RelatorioRascunho,
  RelatorioSnapshot,
} from "@/lib/relatorios/tipos";
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
  ehEmpreiteiroResponsavel: boolean;
  previewAtivo: boolean;
  semRelatorio: boolean;
  ultimoRelatorio: {
    id: string;
    numero: number;
    enviadoEm: string;
    snapshot: RelatorioSnapshot;
    versaoNumero: number;
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
    versaoNumero: number;
    motivo: string | null;
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
  historicoVersoes: {
    relatorioId: string;
    numero: number;
    versaoNumero: number;
    motivo: string | null;
    publicadoEm: string | null;
    pdfPath: string | null;
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
  | {
      ok: false;
      motivo: "nao_autenticado" | "sem_acesso" | "obra_nao_encontrada";
    };

function snapEtapas(
  snapshot: RelatorioSnapshot,
): ClienteObraContexto["etapas"] {
  return snapshot.avancoFisico.etapas.map((etapa, ordem) => ({
    id: `snap-${ordem}`,
    nome: etapa.nome,
    ordem: ordem + 1,
    peso: Number(etapa.peso),
    pctAtual: etapa.pctNovo,
  }));
}

export const carregarDadosCliente = cache(async function carregarDadosCliente(
  obraId: string,
  previewRelatorioId?: string,
): Promise<CarregarClienteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, motivo: "nao_autenticado" };
  }

  const [{ data: obra }, { data: acessoProprio }] = await Promise.all([
    supabase
      .from("obras")
      .select(
        "id, nome, endereco, cliente_nome, construtora, engenheiro, escritorio_arquitetura, arquiteto, projetista_estruturas, projetista_instalacoes, inicio_contratual, termino_contratual, valor_contratado_centavos, lat, lng, owner_id",
      )
      .eq("id", obraId)
      .maybeSingle(),
    supabase
      .from("obra_acessos")
      .select("id")
      .eq("obra_id", obraId)
      .eq("user_id", user.id)
      .eq("status", "ativo")
      .maybeSingle(),
  ]);

  if (!obra && !acessoProprio) {
    return { ok: false, motivo: "sem_acesso" };
  }

  const ehEmpreiteiroResponsavel = obra?.owner_id === user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", user.id)
    .maybeSingle();

  const { data: relatorios } = await supabase
    .from("relatorios")
    .select("id, numero, status, enviado_em, versao_atual_id")
    .eq("obra_id", obraId)
    .eq("status", "enviado")
    .order("numero", { ascending: false });

  const idsVersao = (relatorios ?? [])
    .map((r) => r.versao_atual_id)
    .filter((id): id is string => Boolean(id));

  const { data: versoes } =
    idsVersao.length > 0
      ? await supabase
          .from("relatorio_versoes")
          .select("id, relatorio_id, numero, status, snapshot, motivo, publicado_em, pdf_path, criado_por")
          .in("id", idsVersao)
          .eq("status", "publicada")
      : { data: [] };

  const { data: historico } = await supabase
    .from("relatorio_versoes")
    .select("id, relatorio_id, numero, motivo, publicado_em, pdf_path, status")
    .eq("obra_id", obraId)
    .eq("status", "publicada")
    .order("numero", { ascending: true });

  const versaoPorRelatorio = new Map(
    (versoes ?? []).map((v) => [v.relatorio_id, v]),
  );

  const enviados = (relatorios ?? []).filter((r) => {
    const v = versaoPorRelatorio.get(r.id);
    return r.enviado_em && v?.snapshot;
  });

  const ultimo = enviados[0] ?? null;
  const anterior = enviados[1] ?? null;
  let ultimoRelatorio: ClienteObraContexto["ultimoRelatorio"] = null;
  let previewAtivo = false;
  let listaEtapas: ClienteObraContexto["etapas"] = [];
  let listaLanc: ClienteObraContexto["lancamentos"] = [];
  let listaDias: ClienteObraContexto["diasAditivados"] = [];
  let climaDias: ClienteObraContexto["climaDias"] = [];
  let snapshotVigente: RelatorioSnapshot | null = null;

  if (ultimo) {
    const versao = versaoPorRelatorio.get(ultimo.id)!;
    snapshotVigente = versao.snapshot as unknown as RelatorioSnapshot;
    ultimoRelatorio = {
      id: ultimo.id,
      numero: ultimo.numero,
      enviadoEm: ultimo.enviado_em!,
      snapshot: snapshotVigente,
      versaoNumero: versao.numero,
    };
    listaEtapas = snapEtapas(snapshotVigente);
    listaLanc = snapshotVigente.financeiro.lancamentosNovos.map((l) => ({
      tipo: l.tipo,
      grupo: l.grupo,
      rotulo: l.rotulo,
      valorCentavos: l.valorCentavos,
      numero: null,
    }));
    listaDias = snapshotVigente.prazo.novosDias.map((d) => ({
      motivo: d.motivo,
      descricao: d.descricao ?? null,
      dias: d.dias,
    }));
    climaDias = snapshotVigente.clima.dias.map((d) => ({
      data: typeof d.data === "string" ? d.data.slice(0, 10) : String(d.data),
      condicao: d.condicao,
      probChuva: d.probChuva,
    }));
  }

  if (previewRelatorioId && ehEmpreiteiroResponsavel && obra) {
    const [{ data: relatorioPreview }, { data: etapasVivas }, { data: lancVivos }, { data: diasVivos }, { data: climaVivo }] =
      await Promise.all([
        supabase
          .from("relatorios")
          .select("id, numero, status, dados_rascunho")
          .eq("id", previewRelatorioId)
          .eq("obra_id", obraId)
          .eq("status", "rascunho")
          .maybeSingle(),
        supabase
          .from("etapas")
          .select("id, nome, ordem, peso, pct_atual")
          .eq("obra_id", obraId)
          .order("ordem"),
        supabase
          .from("lancamentos")
          .select("tipo, grupo, rotulo, valor_centavos, numero")
          .eq("obra_id", obraId),
        supabase.from("dias_aditivados").select("motivo, descricao, dias").eq("obra_id", obraId),
        supabase
          .from("clima_snapshots")
          .select("data, condicao, prob_chuva")
          .eq("obra_id", obraId)
          .order("data", { ascending: true }),
      ]);

    if (relatorioPreview?.dados_rascunho) {
      const rascunho =
        relatorioPreview.dados_rascunho as unknown as RelatorioRascunho;
      listaEtapas = (etapasVivas ?? []).map((etapa) => ({
        id: etapa.id,
        nome: etapa.nome,
        ordem: etapa.ordem,
        peso: Number(etapa.peso),
        pctAtual: etapa.pct_atual,
      }));
      listaLanc = (lancVivos ?? []).map((l) => ({
        tipo: l.tipo,
        grupo: l.grupo,
        rotulo: l.rotulo,
        valorCentavos: l.valor_centavos,
        numero: l.numero,
      }));
      listaDias = (diasVivos ?? []).map((d) => ({
        motivo: d.motivo,
        descricao: d.descricao,
        dias: d.dias,
      }));
      const enviadoEm = new Date().toISOString();
      const projecao = montarSnapshotRelatorioEmMemoria({
        numero: relatorioPreview.numero,
        enviadoEm,
        obra: {
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
        },
        etapas: listaEtapas,
        lancamentos: listaLanc,
        diasAditivados: listaDias,
        climaDias: (climaVivo ?? []).map((c) => ({
          data: c.data,
          condicao: c.condicao,
          probChuva: c.prob_chuva,
        })).slice(-7),
        rascunho,
      });
      listaEtapas = projecao.etapasProjetadas.map((etapa) => ({
        ...etapa,
        ordem: listaEtapas.find((item) => item.id === etapa.id)?.ordem ?? 0,
      }));
      listaLanc = [...listaLanc, ...projecao.lancamentosNovos];
      listaDias = [...listaDias, ...projecao.diasNovos];
      ultimoRelatorio = {
        id: relatorioPreview.id,
        numero: relatorioPreview.numero,
        enviadoEm,
        snapshot: projecao.snapshot,
        versaoNumero: 0,
      };
      snapshotVigente = projecao.snapshot;
      previewAtivo = true;
    }
  }

  const avancoGeral = snapshotVigente
    ? snapshotVigente.avancoFisico.geralDepois
    : calcularAvancoGeral(listaEtapas.map((e) => ({ peso: e.peso, pct: e.pctAtual })));

  const obraPublicada = snapshotVigente?.obra;
  const inicioPublico = obraPublicada?.inicioContratual ?? hojeIsoBahia();
  const terminoPublico = obraPublicada?.terminoContratual ?? inicioPublico;
  const valorPublico =
    snapshotVigente?.financeiro.valorContratadoCentavos ?? 0;

  const fin = snapshotVigente
    ? {
        pctPago: snapshotVigente.financeiro.pctPago,
        contratadoTotalCentavos: snapshotVigente.financeiro.contratadoTotalCentavos,
        pagoAcumuladoCentavos: snapshotVigente.financeiro.pagoAcumuladoCentavos,
        saldoCentavos: snapshotVigente.financeiro.saldoCentavos,
        aditivosAcumuladoCentavos: snapshotVigente.financeiro.aditivosAcumuladoCentavos,
      }
    : calcularFinanceiro({
        valorContratadoCentavos: valorPublico,
        aditivosCentavos: [],
        pagoCentavos: [],
        estornosAditivosCentavos: [],
      });

  const totalDiasAditivados =
    snapshotVigente?.prazo.totalDiasAditivados ??
    listaDias.map((d) => d.dias).reduce((a, b) => a + b, 0);
  const entregaPrevista =
    snapshotVigente?.prazo.novaDataTermino ??
    calcularNovaDataTermino(terminoPublico, listaDias.map((d) => d.dias));
  const hoje = hojeIsoBahia();

  const fotosComUrl: ClienteObraContexto["fotos"] = [];
  const paths = new Map<string, { etapaNome: string; relatorioId: string; enviadoEm: string; ordem: number }>();
  for (const r of enviados) {
    const snap = versaoPorRelatorio.get(r.id)?.snapshot as unknown as RelatorioSnapshot | undefined;
    if (!snap) continue;
    snap.atividades.forEach((atividade, i) => {
      atividade.fotosPaths.forEach((storagePath, ordem) => {
        paths.set(storagePath, {
          etapaNome: atividade.etapaNome,
          relatorioId: r.id,
          enviadoEm: r.enviado_em ?? "",
          ordem: ordem + 1 + i,
        });
      });
    });
  }
  if (previewAtivo && ultimoRelatorio) {
    ultimoRelatorio.snapshot.atividades.forEach((atividade) => {
      atividade.fotosPaths.forEach((storagePath, ordem) => {
        paths.set(storagePath, {
          etapaNome: atividade.etapaNome,
          relatorioId: ultimoRelatorio!.id,
          enviadoEm: ultimoRelatorio!.enviadoEm,
          ordem: ordem + 1,
        });
      });
    });
  }

  for (const [storagePath, meta] of paths) {
    const { data: signed } = await supabase.storage
      .from("fotos")
      .createSignedUrl(storagePath, 3600);
    fotosComUrl.push({
      id: storagePath,
      storagePath,
      etapaId: meta.etapaNome,
      etapaNome: meta.etapaNome,
      relatorioId: meta.relatorioId,
      relatorioEnviadoEm: meta.enviadoEm,
      ordem: meta.ordem,
      urlAssinada: signed?.signedUrl ?? null,
    });
  }

  return {
    ok: true,
    dados: {
      obra: {
        id: obraId,
        nome: obraPublicada?.nome ?? "Obra",
        endereco: obraPublicada?.endereco ?? "",
        clienteNome: obraPublicada?.clienteNome ?? "",
        construtora: obraPublicada?.construtora ?? null,
        engenheiro: obraPublicada?.engenheiro ?? null,
        escritorioArquitetura: obraPublicada?.escritorioArquitetura ?? null,
        arquiteto: obraPublicada?.arquiteto ?? null,
        projetistaEstruturas: obraPublicada?.projetistaEstruturas ?? null,
        projetistaInstalacoes: obraPublicada?.projetistaInstalacoes ?? null,
        inicioContratual: inicioPublico,
        terminoContratual: terminoPublico,
        valorContratadoCentavos: valorPublico,
        lat: null,
        lng: null,
      },
      usuario: {
        id: user.id,
        email: user.email ?? "",
        nome:
          profile?.nome?.trim() || user.email?.split("@")[0] || "Proprietário",
      },
      temAcesso: true,
      ehEmpreiteiroResponsavel,
      previewAtivo,
      semRelatorio: !ultimoRelatorio,
      ultimoRelatorio,
      relatorioAnterior: anterior?.enviado_em
        ? {
            id: anterior.id,
            numero: anterior.numero,
            enviadoEm: anterior.enviado_em,
          }
        : null,
      todosRelatorios: enviados.map((r) => ({
        id: r.id,
        numero: r.numero,
        enviadoEm: r.enviado_em!,
        versaoNumero: versaoPorRelatorio.get(r.id)?.numero ?? 1,
        motivo: versaoPorRelatorio.get(r.id)?.motivo ?? null,
      })),
      etapas: listaEtapas,
      lancamentos: listaLanc,
      diasAditivados: listaDias,
      climaDias,
      fotos: fotosComUrl,
      historicoVersoes: (historico ?? []).map((h) => ({
        relatorioId: h.relatorio_id,
        numero: 0,
        versaoNumero: h.numero,
        motivo: h.motivo,
        publicadoEm: h.publicado_em,
        pdfPath: h.pdf_path,
      })),
      agregados: {
        avancoGeral,
        pctPago: fin.pctPago,
        contratadoTotalCentavos: fin.contratadoTotalCentavos,
        pagoAcumuladoCentavos: fin.pagoAcumuladoCentavos,
        saldoCentavos: fin.saldoCentavos,
        aditivosAcumuladoCentavos: fin.aditivosAcumuladoCentavos,
        entregaPrevista: String(entregaPrevista).slice(0, 10),
        diasDeObra: diasDeObra(inicioPublico, hoje),
        diasRestantes: diasRestantes(String(entregaPrevista).slice(0, 10), hoje),
        totalDiasAditivados,
      },
    },
  };
});
