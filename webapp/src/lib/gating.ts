export type AssinaturaStatus =
  | "trial"
  | "ativa"
  | "inadimplente"
  | "cancelada";

export interface EstadoAssinatura {
  status: AssinaturaStatus;
  limiteObras: number;
  obrasAtivas: number;
  trialFim: Date | null;
  relatoriosEnviadosTrial: number;
  agora?: Date;
}

function dentroDoTrial(a: EstadoAssinatura): boolean {
  if (a.status !== "trial") return false;
  if (!a.trialFim) return false;
  return (a.agora ?? new Date()) <= a.trialFim;
}

export function podeCriarObra(a: EstadoAssinatura): boolean {
  if (a.status === "inadimplente" || a.status === "cancelada") return false;
  if (a.status === "trial") return a.obrasAtivas < 1;
  return a.obrasAtivas < a.limiteObras;
}

export function podeEditarRascunho(a: EstadoAssinatura): boolean {
  return a.status === "trial" || a.status === "ativa";
}

export function podeEnviarRelatorio(a: EstadoAssinatura): boolean {
  if (a.status === "ativa") return true;
  if (a.status === "trial") {
    return dentroDoTrial(a) && a.relatoriosEnviadosTrial < 1;
  }
  return false;
}

export function podeAdicionarEmailExtra(a: EstadoAssinatura): boolean {
  return a.status === "ativa";
}

export function podeVerSomenteLeitura(a: EstadoAssinatura): boolean {
  return (
    a.status === "trial" ||
    a.status === "ativa" ||
    a.status === "inadimplente" ||
    a.status === "cancelada"
  );
}
