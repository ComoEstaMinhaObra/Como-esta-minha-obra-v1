import type { DuracaoDesconto } from "./formatar";

/** Retorno de fn_admin_afiliados (jsonb em camelCase). */
export interface LinkAdmin {
  id: string;
  codigo: string;
  rotulo: string;
  ativo: boolean;
  afiliadoId: string;
  afiliadoNome: string;
  afiliadoEmail: string | null;
  comissaoBps: number;
  vitalicia: boolean;
  descontoBps: number;
  descontoDuracao: DuracaoDesconto | null;
  criadoEm: string;
  cadastros: number;
  assinantes: number;
  ganhosCentavos: number;
}

export interface AdminAfiliados {
  config: { carenciaDias: number; saqueMinimoCentavos: number };
  resumo: {
    saquesPendentes: number;
    saquesPendentesCentavos: number;
    saldoAfiliadosCentavos: number;
  };
  links: LinkAdmin[];
}

export interface SaqueAdmin {
  id: string;
  afiliadoId: string;
  afiliadoNome: string;
  afiliadoEmail: string | null;
  valorCentavos: number;
  tipoChave: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria";
  chavePix: string;
  status: "solicitado" | "pago" | "recusado";
  solicitadoEm: string;
  resolvidoEm: string | null;
  observacao: string | null;
}

export interface ComissaoAdmin {
  id: string;
  em: string;
  afiliadoNome: string;
  linkCodigo: string;
  indicadoNome: string;
  valorCentavos: number;
  baseCentavos: number | null;
  comissaoBps: number | null;
  disponivelEm: string;
  pagamentoId: string | null;
  estornada: boolean;
}

export const ROTULO_TIPO_CHAVE: Record<SaqueAdmin["tipoChave"], string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  email: "E-mail",
  telefone: "Telefone",
  aleatoria: "Chave aleatória",
};
