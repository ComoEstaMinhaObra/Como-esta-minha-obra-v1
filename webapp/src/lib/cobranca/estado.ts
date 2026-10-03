import {
  estadoCobrancaTela,
  type CobrancaObra,
  type EstadoCobrancaTela,
} from "@/lib/gating";
import { DIAS_RECUPERACAO } from "@/lib/cobranca/constantes";

const DIA = 86400000;

export interface ObraLinhaDb {
  id: string;
  nome: string;
  arquivada_em: string | null;
}

export interface CobrancaLinhaDb {
  obra_id: string;
  status: CobrancaObra["status"];
  valor_centavos: number;
  periodo_fim: string;
  primeira_cobranca_em: string | null;
  inadimplente_desde: string | null;
  acesso_ate: string | null;
  criado_em: string;
}

export interface ContaLinhaDb {
  status: "trial" | "ativa" | "inadimplente" | "cancelada";
  trial_fim: string | null;
  relatorios_enviados_trial: number;
}

export interface LinhaCobranca {
  obraId: string;
  nome: string;
  arquivada: boolean;
  estado: EstadoCobrancaTela;
  valorCentavos: number | null;
  /** Data da próxima cobrança (fim do período ou primeira cobrança adiada). */
  proximaCobranca: Date | null;
  primeiraCobrancaAdiada: boolean;
  acessoAte: Date | null;
  inadimplenteDesde: Date | null;
  /** Data em que a assinatura da obra é cancelada se o pagamento não for regularizado. */
  limiteRecuperacao: Date | null;
  /** Obra sem assinatura usando o trial da conta. */
  emTrialAte: Date | null;
  /** Obra coberta pela assinatura da conta do modelo antigo (até a limpeza da E5). */
  legado: boolean;
  acoes: {
    contratar: boolean;
    cancelar: boolean;
    reativar: boolean;
    /** Data a partir da qual a reativação é permitida (período já pago em andamento). */
    reativarApos: Date | null;
  };
}

export interface ResumoCobranca {
  linhas: LinhaCobranca[];
  totalMensalCentavos: number;
  proximaCobranca: Date | null;
  trial: { diasRestantes: number; relatoriosUsados: number } | null;
}

function data(v: string | null): Date | null {
  return v ? new Date(v) : null;
}

/** Monta o que a tela de Cobrança mostra, por obra, a partir das linhas do banco. */
export function montarResumoCobranca(
  obras: ObraLinhaDb[],
  cobrancas: CobrancaLinhaDb[],
  conta: ContaLinhaDb | null,
  agora: Date = new Date(),
): ResumoCobranca {
  const trialFim = data(conta?.trial_fim ?? null);
  const donoJaTeveCobranca = cobrancas.length > 0;
  const trialValido =
    conta?.status === "trial" &&
    trialFim !== null &&
    agora <= trialFim &&
    !donoJaTeveCobranca;

  const linhas: LinhaCobranca[] = [];

  for (const o of obras) {
    const doObra = cobrancas
      .filter((c) => c.obra_id === o.id)
      .sort((a, b) => b.criado_em.localeCompare(a.criado_em));
    const arquivada = o.arquivada_em !== null;
    const estado = estadoCobrancaTela(
      doObra.map((c) => ({ status: c.status, acessoAte: data(c.acesso_ate) })),
    );
    const atual = doObra.find((c) => c.status !== "cancelada") ?? doObra[0] ?? null;

    // Obra arquivada só aparece enquanto ainda há período pago em andamento.
    const acessoAte = data(atual?.acesso_ate ?? null);
    if (arquivada && !(estado === "cancelamento_agendado" && acessoAte && acessoAte > agora)) {
      continue;
    }

    const primeira = data(atual?.primeira_cobranca_em ?? null);
    const adiada = !!primeira && primeira > agora;
    const inadimplenteDesde = data(atual?.inadimplente_desde ?? null);
    const legado =
      estado === "sem_assinatura" && conta?.status === "ativa" && !arquivada;

    const reativarApos =
      estado === "cancelamento_agendado" && acessoAte && acessoAte > agora ? acessoAte : null;

    linhas.push({
      obraId: o.id,
      nome: o.nome,
      arquivada,
      estado,
      valorCentavos: atual ? atual.valor_centavos : null,
      proximaCobranca:
        estado === "ativa" ? (adiada ? primeira : data(atual?.periodo_fim ?? null)) : null,
      primeiraCobrancaAdiada: estado === "ativa" && adiada,
      acessoAte,
      inadimplenteDesde,
      limiteRecuperacao: inadimplenteDesde
        ? new Date(inadimplenteDesde.getTime() + DIAS_RECUPERACAO * DIA)
        : null,
      emTrialAte: estado === "sem_assinatura" && trialValido && !arquivada ? trialFim : null,
      legado,
      acoes: {
        contratar: estado === "sem_assinatura" && !arquivada && !legado,
        cancelar: estado === "ativa" && !arquivada,
        reativar:
          !arquivada &&
          (estado === "cancelada" || (estado === "cancelamento_agendado" && reativarApos === null)),
        reativarApos: arquivada ? null : reativarApos,
      },
    });
  }

  const totalMensalCentavos = cobrancas
    .filter((c) => c.status === "ativa" || c.status === "inadimplente")
    .reduce((s, c) => s + c.valor_centavos, 0);

  const proximas = linhas
    .map((l) => l.proximaCobranca)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    linhas,
    totalMensalCentavos,
    proximaCobranca: proximas[0] ?? null,
    trial:
      conta?.status === "trial" && trialValido && trialFim
        ? {
            diasRestantes: Math.max(0, Math.ceil((trialFim.getTime() - agora.getTime()) / DIA)),
            relatoriosUsados: conta.relatorios_enviados_trial,
          }
        : null,
  };
}
