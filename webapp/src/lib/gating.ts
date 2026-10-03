/**
 * Gating por obra (decisões de 01/10/2026). Espelha, para a interface, as regras que o banco impõe
 * em private.obra_permite_escrita e fn_criar_obra; o banco é a fonte da verdade.
 */
import { TRIAL } from "@/config/pricing";

/** Estado da conta: trial e, no modelo antigo (legado até a E5), ativa/inadimplente/cancelada. */
export type AssinaturaStatus =
  | "trial"
  | "ativa"
  | "inadimplente"
  | "cancelada";

export type CobrancaStatus =
  | "ativa"
  | "inadimplente"
  | "cancelamento_agendado"
  | "cancelada";

export interface CobrancaObra {
  status: CobrancaStatus;
  acessoAte: Date | null;
}

export interface ContaGating {
  status: AssinaturaStatus;
  trialFim: Date | null;
  relatoriosEnviadosTrial: number;
}

export interface EstadoObra {
  /** Todas as cobranças da obra (vazia se a obra nunca teve cobrança). */
  cobrancas: CobrancaObra[];
  /** O dono já teve cobrança em alguma obra? Quem já pagou deixa o trial para trás. */
  donoJaTeveCobranca: boolean;
  conta: ContaGating;
  agora?: Date;
}

function agoraDe(e: { agora?: Date }): Date {
  return e.agora ?? new Date();
}

/** Cobrança vigente: ativa, ou cancelada pelo usuário mas dentro do período já pago. */
export function cobrancaVigente(
  cobrancas: CobrancaObra[],
  agora: Date = new Date(),
): boolean {
  return cobrancas.some(
    (c) =>
      c.status === "ativa" ||
      (c.status === "cancelamento_agendado" &&
        c.acessoAte !== null &&
        agora <= c.acessoAte),
  );
}

/** Editar rascunho, enviar relatório, compartilhar e subir fotos (espelha private.obra_permite_escrita). */
export function obraPermiteEscrita(e: EstadoObra): boolean {
  const agora = agoraDe(e);
  if (cobrancaVigente(e.cobrancas, agora)) return true;
  // Obra com histórico de cobrança sem cobrança vigente: somente leitura.
  if (e.cobrancas.length > 0) return false;

  if (e.conta.status === "trial") {
    return (
      e.conta.trialFim !== null &&
      agora <= e.conta.trialFim &&
      !e.donoJaTeveCobranca
    );
  }
  // Legado (até a E5): conta ativa do modelo antigo.
  return e.conta.status === "ativa";
}

export function podeEditarRascunho(e: EstadoObra): boolean {
  return obraPermiteEscrita(e);
}

/** O trial permite 1 envio por conta; obra com cobrança vigente não usa esse limite. */
export function podeEnviarRelatorio(e: EstadoObra): boolean {
  if (!obraPermiteEscrita(e)) return false;
  if (
    e.conta.status === "trial" &&
    !cobrancaVigente(e.cobrancas, agoraDe(e)) &&
    e.conta.relatoriosEnviadosTrial >= TRIAL.limiteRelatorios
  ) {
    return false;
  }
  return true;
}

/** Acesso adicional de e-mail só em obra com cobrança vigente (ou conta ativa do legado). */
export function podeAdicionarEmailExtra(e: EstadoObra): boolean {
  return cobrancaVigente(e.cobrancas, agoraDe(e)) || e.conta.status === "ativa";
}

/** Toda obra pode ser consultada, em qualquer estado de cobrança. */
export function podeVerSomenteLeitura(): boolean {
  return true;
}

export interface EstadoCriarObra {
  conta: ContaGating;
  /** O usuário tem alguma cobrança vigente (em qualquer obra)? */
  temCobrancaVigente: boolean;
  obrasAtivas: number;
  agora?: Date;
}

/**
 * Criar obra (espelha fn_criar_obra): quem paga cria sem limite, e cada obra só escreve com a
 * própria cobrança; sem cobrança vale o trial, com uma obra dentro do prazo.
 */
export function podeCriarObra(e: EstadoCriarObra): boolean {
  if (e.conta.status === "ativa" || e.temCobrancaVigente) return true;
  if (e.conta.status !== "trial") return false;
  const agora = agoraDe(e);
  return (
    e.conta.trialFim !== null &&
    agora <= e.conta.trialFim &&
    e.obrasAtivas < TRIAL.limiteObras
  );
}

/** Estado de cobrança de uma obra para a tela de Cobrança. */
export type EstadoCobrancaTela =
  | "sem_assinatura"
  | "ativa"
  | "inadimplente"
  | "cancelamento_agendado"
  | "cancelada";

export function estadoCobrancaTela(cobrancas: CobrancaObra[]): EstadoCobrancaTela {
  // Considera a cobrança não cancelada (no máximo uma por obra) ou, se só houver canceladas, a cancelada.
  const naoCancelada = cobrancas.find((c) => c.status !== "cancelada");
  if (naoCancelada) return naoCancelada.status;
  return cobrancas.length > 0 ? "cancelada" : "sem_assinatura";
}
