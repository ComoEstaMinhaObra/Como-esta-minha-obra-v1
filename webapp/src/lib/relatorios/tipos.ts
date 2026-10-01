export type MotivoAditivo =
  | "chuvas"
  | "aditivo_escopo"
  | "atraso_materiais"
  | "licencas"
  | "interferencias"
  | "forca_maior"
  | "outro";

export interface RelatorioRascunho {
  versao: 1;
  etapas: { etapaId: string; pct: number }[];
  financeiro: {
    medicoes: { valorCentavos: number }[];
    materiais: { rotulo: string; valorCentavos: number }[];
    aditivos: { descricao: string; valorCentavos: number }[];
    supressoes: { descricao: string; valorCentavos: number }[];
    /** Estorno sempre vinculado a um lançamento já persistido da obra. */
    estornos: {
      origemId: string;
      descricao: string;
      valorCentavos: number;
    }[];
  };
  atividades: { etapaId: string; nota: string; fotosPaths: string[] }[];
  prazo: { motivo: MotivoAditivo; descricao?: string; dias: number }[];
}

export interface RelatorioSnapshot {
  versao: 1;
  numero: number;
  enviadoEm: string;
  obra: {
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
  };
  avancoFisico: {
    geralAntes: number;
    geralDepois: number;
    etapas: {
      nome: string;
      peso: number;
      pctAnterior: number;
      pctNovo: number;
    }[];
  };
  financeiro: {
    valorContratadoCentavos: number;
    aditivosAcumuladoCentavos: number;
    supressoesAcumuladoCentavos?: number;
    contratadoTotalCentavos: number;
    pagoAcumuladoCentavos: number;
    pctPago: number;
    saldoCentavos: number;
    lancamentosNovos: {
      tipo: string;
      grupo: string;
      rotulo: string;
      valorCentavos: number;
    }[];
  };
  prazo: {
    novosDias: { motivo: string; descricao?: string; dias: number }[];
    totalDiasAditivados: number;
    novaDataTermino: string;
  };
  atividades: { etapaNome: string; nota: string; fotosPaths: string[] }[];
  clima: {
    dias: {
      data: string;
      condicao: "aberto" | "nublado" | "chuvoso";
      probChuva: number | null;
    }[];
  };
}

/** Lançamento financeiro já persistido da obra (base de estornos e totais). */
export interface LancamentoPersistido {
  id: string;
  tipo: "sinal" | "medicao" | "material" | "aditivo" | "supressao" | "estorno";
  grupo: "medicoes" | "materiais" | "aditivos" | "supressoes";
  rotulo: string;
  valorCentavos: number;
  numero: number | null;
  relatorioId: string | null;
  origemId: string | null;
}
