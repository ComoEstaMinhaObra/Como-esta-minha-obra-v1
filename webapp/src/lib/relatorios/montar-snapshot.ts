import {
  calcularAvancoGeral,
  calcularFinanceiro,
  calcularNovaDataTermino,
} from "@/lib/relatorios/calculos";
import type {
  RelatorioRascunho,
  RelatorioSnapshot,
} from "@/lib/relatorios/tipos";

type ObraSnapshot = {
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
};

type EtapaSnapshot = {
  id: string;
  nome: string;
  peso: number;
  pctAtual: number;
};

type LancamentoSnapshot = {
  tipo: string;
  grupo: string;
  rotulo: string;
  valorCentavos: number;
  numero: number | null;
};

type DiaAditivadoSnapshot = {
  motivo: string;
  descricao: string | null;
  dias: number;
};

type ClimaSnapshot = {
  data: string;
  condicao: "aberto" | "nublado" | "chuvoso";
  probChuva: number | null;
};

export type SnapshotRelatorioEmMemoria = {
  snapshot: RelatorioSnapshot;
  etapasProjetadas: EtapaSnapshot[];
  lancamentosNovos: LancamentoSnapshot[];
  diasNovos: DiaAditivadoSnapshot[];
};

function rotuloNumerado(prefixo: string, numero: number) {
  return `${prefixo} ${String(numero).padStart(2, "0")}`;
}

export function montarSnapshotRelatorioEmMemoria(params: {
  numero: number;
  enviadoEm: string;
  obra: ObraSnapshot;
  etapas: EtapaSnapshot[];
  lancamentos: LancamentoSnapshot[];
  diasAditivados: DiaAditivadoSnapshot[];
  climaDias: ClimaSnapshot[];
  rascunho: RelatorioRascunho;
}): SnapshotRelatorioEmMemoria {
  const etapaPorId = new Map(params.etapas.map((etapa) => [etapa.id, etapa]));
  const pctPorEtapa = new Map(
    params.rascunho.etapas.map((etapa) => [etapa.etapaId, etapa.pct]),
  );

  const etapasProjetadas = params.etapas.map((etapa) => {
    const pctNovo = pctPorEtapa.get(etapa.id) ?? etapa.pctAtual;
    if (pctNovo < etapa.pctAtual) throw new Error("PCT_REGREDIU");
    if (pctNovo < 0 || pctNovo > 100) throw new Error("PCT_INVALIDO");
    return { ...etapa, pctAtual: pctNovo };
  });

  for (const etapa of params.rascunho.etapas) {
    if (!etapaPorId.has(etapa.etapaId)) throw new Error("ETAPA_INVALIDA");
  }

  const geralAntes = calcularAvancoGeral(
    params.etapas.map((etapa) => ({ peso: etapa.peso, pct: etapa.pctAtual })),
  );
  const geralDepois = calcularAvancoGeral(
    etapasProjetadas.map((etapa) => ({
      peso: etapa.peso,
      pct: etapa.pctAtual,
    })),
  );

  const maxMedicao = Math.max(
    0,
    ...params.lancamentos
      .filter((lancamento) => lancamento.tipo === "medicao")
      .map((lancamento) => lancamento.numero ?? 0),
  );
  const maxAditivo = Math.max(
    0,
    ...params.lancamentos
      .filter((lancamento) => lancamento.tipo === "aditivo")
      .map((lancamento) => lancamento.numero ?? 0),
  );

  const lancamentosNovos: LancamentoSnapshot[] = [
    ...params.rascunho.financeiro.medicoes.map((medicao, index) => {
      const numero = maxMedicao + index + 1;
      return {
        tipo: "medicao",
        grupo: "medicoes",
        rotulo: rotuloNumerado("Medição", numero),
        valorCentavos: medicao.valorCentavos,
        numero,
      };
    }),
    ...params.rascunho.financeiro.materiais.map((material) => ({
      tipo: "material",
      grupo: "materiais",
      rotulo: material.rotulo,
      valorCentavos: material.valorCentavos,
      numero: null,
    })),
    ...params.rascunho.financeiro.aditivos.map((aditivo, index) => {
      const numero = maxAditivo + index + 1;
      return {
        tipo: "aditivo",
        grupo: "aditivos",
        rotulo: `${rotuloNumerado("Aditivo", numero)} — ${aditivo.descricao}`,
        valorCentavos: aditivo.valorCentavos,
        numero,
      };
    }),
    ...params.rascunho.financeiro.estornos.map((estorno) => ({
      tipo: "estorno",
      grupo: estorno.grupo,
      rotulo: `Estorno — ${estorno.descricao}`,
      valorCentavos: -Math.abs(estorno.valorCentavos),
      numero: null,
    })),
  ];

  const lancamentosProjetados = [...params.lancamentos, ...lancamentosNovos];
  const aditivosCentavos = lancamentosProjetados
    .filter((lancamento) => lancamento.tipo === "aditivo")
    .map((lancamento) => lancamento.valorCentavos);
  const estornosAditivosCentavos = lancamentosProjetados
    .filter(
      (lancamento) =>
        lancamento.tipo === "estorno" && lancamento.grupo === "aditivos",
    )
    .map((lancamento) => lancamento.valorCentavos);
  const pagoCentavos = lancamentosProjetados
    .filter((lancamento) =>
      ["sinal", "medicao", "material", "estorno"].includes(lancamento.tipo),
    )
    .filter(
      (lancamento) =>
        !(lancamento.tipo === "estorno" && lancamento.grupo === "aditivos"),
    )
    .map((lancamento) => lancamento.valorCentavos);
  const financeiro = calcularFinanceiro({
    valorContratadoCentavos: params.obra.valorContratadoCentavos,
    aditivosCentavos,
    pagoCentavos,
    estornosAditivosCentavos,
  });

  const diasNovos = params.rascunho.prazo.map((prazo) => ({
    motivo: prazo.motivo,
    descricao: prazo.descricao ?? null,
    dias: prazo.dias,
  }));
  const todosDias = [...params.diasAditivados, ...diasNovos];
  const totalDiasAditivados = todosDias.reduce(
    (total, item) => total + item.dias,
    0,
  );

  const atividades = params.rascunho.atividades.map((atividade) => {
    const etapa = etapaPorId.get(atividade.etapaId);
    if (!etapa) throw new Error("ETAPA_INVALIDA");
    return {
      etapaNome: etapa.nome,
      nota: atividade.nota,
      fotosPaths: atividade.fotosPaths,
    };
  });

  return {
    etapasProjetadas,
    lancamentosNovos,
    diasNovos,
    snapshot: {
      versao: 1,
      numero: params.numero,
      enviadoEm: params.enviadoEm,
      obra: {
        nome: params.obra.nome,
        endereco: params.obra.endereco,
        clienteNome: params.obra.clienteNome,
        construtora: params.obra.construtora ?? undefined,
        engenheiro: params.obra.engenheiro ?? undefined,
        escritorioArquitetura: params.obra.escritorioArquitetura ?? undefined,
        arquiteto: params.obra.arquiteto ?? undefined,
        projetistaEstruturas: params.obra.projetistaEstruturas ?? undefined,
        projetistaInstalacoes: params.obra.projetistaInstalacoes ?? undefined,
        inicioContratual: params.obra.inicioContratual,
        terminoContratual: params.obra.terminoContratual,
      },
      avancoFisico: {
        geralAntes,
        geralDepois,
        etapas: params.etapas.map((etapa) => ({
          nome: etapa.nome,
          peso: etapa.peso,
          pctAnterior: etapa.pctAtual,
          pctNovo: pctPorEtapa.get(etapa.id) ?? etapa.pctAtual,
        })),
      },
      financeiro: {
        valorContratadoCentavos: params.obra.valorContratadoCentavos,
        aditivosAcumuladoCentavos: financeiro.aditivosAcumuladoCentavos,
        contratadoTotalCentavos: financeiro.contratadoTotalCentavos,
        pagoAcumuladoCentavos: financeiro.pagoAcumuladoCentavos,
        pctPago: financeiro.pctPago,
        saldoCentavos: financeiro.saldoCentavos,
        lancamentosNovos: lancamentosNovos.map((lancamento) => ({
          tipo: lancamento.tipo,
          grupo: lancamento.grupo,
          rotulo: lancamento.rotulo,
          valorCentavos: lancamento.valorCentavos,
        })),
      },
      prazo: {
        novosDias: diasNovos.map((dia) => ({
          motivo: dia.motivo,
          descricao: dia.descricao ?? undefined,
          dias: dia.dias,
        })),
        totalDiasAditivados,
        novaDataTermino: calcularNovaDataTermino(
          params.obra.terminoContratual,
          todosDias.map((dia) => dia.dias),
        ),
      },
      atividades,
      clima: { dias: params.climaDias.slice(-7) },
    },
  };
}
