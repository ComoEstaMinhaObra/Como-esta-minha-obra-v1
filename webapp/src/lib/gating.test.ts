import { describe, expect, it } from "vitest";
import {
  cobrancaVigente,
  estadoCobrancaTela,
  obraPermiteEscrita,
  podeAdicionarEmailExtra,
  podeCriarObra,
  podeEditarRascunho,
  podeEnviarRelatorio,
  podeVerSomenteLeitura,
  type CobrancaObra,
  type EstadoCriarObra,
  type EstadoObra,
} from "@/lib/gating";

const DIA = 86400000;
const futuro = (dias = 7) => new Date(Date.now() + dias * DIA);
const passado = (dias = 1) => new Date(Date.now() - dias * DIA);

const ativa: CobrancaObra = { status: "ativa", acessoAte: null };
const inadimplente: CobrancaObra = { status: "inadimplente", acessoAte: null };
const cancelada: CobrancaObra = { status: "cancelada", acessoAte: passado() };
const agendadaFutura: CobrancaObra = {
  status: "cancelamento_agendado",
  acessoAte: futuro(),
};
const agendadaVencida: CobrancaObra = {
  status: "cancelamento_agendado",
  acessoAte: passado(),
};

const obra = (over: Partial<EstadoObra> = {}): EstadoObra => ({
  cobrancas: [],
  donoJaTeveCobranca: false,
  conta: { status: "trial", trialFim: futuro(), relatoriosEnviadosTrial: 0 },
  ...over,
});

describe("cobrancaVigente", () => {
  it("ativa e cancelamento agendado dentro do período pago são vigentes", () => {
    expect(cobrancaVigente([ativa])).toBe(true);
    expect(cobrancaVigente([agendadaFutura])).toBe(true);
  });

  it("inadimplente, cancelada e cancelamento vencido não são vigentes", () => {
    expect(cobrancaVigente([inadimplente])).toBe(false);
    expect(cobrancaVigente([cancelada])).toBe(false);
    expect(cobrancaVigente([agendadaVencida])).toBe(false);
    expect(cobrancaVigente([])).toBe(false);
  });
});

describe("obraPermiteEscrita (espelha private.obra_permite_escrita)", () => {
  it("cobrança ativa aceita escrita, mesmo com o trial da conta vencido", () => {
    expect(
      obraPermiteEscrita(
        obra({
          cobrancas: [ativa],
          donoJaTeveCobranca: true,
          conta: { status: "trial", trialFim: passado(), relatoriosEnviadosTrial: 1 },
        }),
      ),
    ).toBe(true);
  });

  it("cancelamento agendado mantém os recursos até acesso_ate", () => {
    expect(obraPermiteEscrita(obra({ cobrancas: [agendadaFutura], donoJaTeveCobranca: true }))).toBe(true);
    expect(obraPermiteEscrita(obra({ cobrancas: [agendadaVencida], donoJaTeveCobranca: true }))).toBe(false);
  });

  it("obra inadimplente ou cancelada fica somente leitura, mesmo no trial", () => {
    expect(obraPermiteEscrita(obra({ cobrancas: [inadimplente], donoJaTeveCobranca: true }))).toBe(false);
    expect(obraPermiteEscrita(obra({ cobrancas: [cancelada], donoJaTeveCobranca: true }))).toBe(false);
    expect(
      obraPermiteEscrita(
        obra({
          cobrancas: [inadimplente],
          conta: { status: "ativa", trialFim: null, relatoriosEnviadosTrial: 0 },
        }),
      ),
    ).toBe(false);
  });

  it("trial dentro do prazo, sem cobrança, aceita escrita; vencido não", () => {
    expect(obraPermiteEscrita(obra())).toBe(true);
    expect(
      obraPermiteEscrita(
        obra({ conta: { status: "trial", trialFim: passado(), relatoriosEnviadosTrial: 0 } }),
      ),
    ).toBe(false);
  });

  it("quem já pagou outra obra não usa o trial na obra sem cobrança", () => {
    expect(obraPermiteEscrita(obra({ donoJaTeveCobranca: true }))).toBe(false);
  });

  it("conta fora do trial, sem cobrança da obra, não escreve (não existe mais o legado)", () => {
    const conta = { status: "ativa" as const, trialFim: null, relatoriosEnviadosTrial: 0 };
    expect(obraPermiteEscrita(obra({ conta }))).toBe(false);
    expect(obraPermiteEscrita(obra({ conta: { ...conta, status: "inadimplente" } }))).toBe(false);
    expect(obraPermiteEscrita(obra({ conta: { ...conta, status: "cancelada" } }))).toBe(false);
  });

  it("podeEditarRascunho acompanha a escrita", () => {
    expect(podeEditarRascunho(obra())).toBe(true);
    expect(podeEditarRascunho(obra({ cobrancas: [inadimplente], donoJaTeveCobranca: true }))).toBe(false);
  });
});

describe("podeEnviarRelatorio", () => {
  it("trial permite 1 envio por conta", () => {
    expect(podeEnviarRelatorio(obra())).toBe(true);
    expect(
      podeEnviarRelatorio(
        obra({ conta: { status: "trial", trialFim: futuro(), relatoriosEnviadosTrial: 1 } }),
      ),
    ).toBe(false);
  });

  it("obra com cobrança vigente não usa o limite do trial", () => {
    expect(
      podeEnviarRelatorio(
        obra({
          cobrancas: [ativa],
          donoJaTeveCobranca: true,
          conta: { status: "trial", trialFim: futuro(), relatoriosEnviadosTrial: 1 },
        }),
      ),
    ).toBe(true);
  });

  it("obra sem escrita não envia", () => {
    expect(podeEnviarRelatorio(obra({ cobrancas: [cancelada], donoJaTeveCobranca: true }))).toBe(false);
  });
});

describe("outros gates", () => {
  it("e-mail adicional só com cobrança vigente", () => {
    expect(podeAdicionarEmailExtra(obra())).toBe(false);
    expect(podeAdicionarEmailExtra(obra({ cobrancas: [ativa], donoJaTeveCobranca: true }))).toBe(true);
    expect(
      podeAdicionarEmailExtra(
        obra({ conta: { status: "ativa", trialFim: null, relatoriosEnviadosTrial: 0 } }),
      ),
    ).toBe(false);
  });

  it("toda obra pode ser consultada", () => {
    expect(podeVerSomenteLeitura()).toBe(true);
  });
});

describe("podeCriarObra (espelha fn_criar_obra)", () => {
  const base = (over: Partial<EstadoCriarObra> = {}): EstadoCriarObra => ({
    conta: { status: "trial", trialFim: futuro(), relatoriosEnviadosTrial: 0 },
    temCobrancaVigente: false,
    obrasAtivas: 0,
    ...over,
  });

  it("trial cria uma obra dentro do prazo", () => {
    expect(podeCriarObra(base())).toBe(true);
    expect(podeCriarObra(base({ obrasAtivas: 1 }))).toBe(false);
    expect(
      podeCriarObra(base({ conta: { status: "trial", trialFim: passado(), relatoriosEnviadosTrial: 0 } })),
    ).toBe(false);
  });

  it("quem tem cobrança vigente cria obras sem limite", () => {
    expect(podeCriarObra(base({ temCobrancaVigente: true, obrasAtivas: 7 }))).toBe(true);
  });

  it("conta fora do trial só cria com cobrança vigente", () => {
    const conta = { status: "ativa" as const, trialFim: null, relatoriosEnviadosTrial: 0 };
    expect(podeCriarObra(base({ conta, obrasAtivas: 4 }))).toBe(false);
    expect(podeCriarObra(base({ conta: { ...conta, status: "inadimplente" } }))).toBe(false);
    expect(podeCriarObra(base({ conta: { ...conta, status: "cancelada" } }))).toBe(false);
    expect(podeCriarObra(base({ conta, temCobrancaVigente: true, obrasAtivas: 4 }))).toBe(true);
  });
});

describe("estadoCobrancaTela", () => {
  it("resume o estado da obra para a tela de Cobrança", () => {
    expect(estadoCobrancaTela([])).toBe("sem_assinatura");
    expect(estadoCobrancaTela([ativa])).toBe("ativa");
    expect(estadoCobrancaTela([inadimplente])).toBe("inadimplente");
    expect(estadoCobrancaTela([agendadaFutura])).toBe("cancelamento_agendado");
    expect(estadoCobrancaTela([cancelada])).toBe("cancelada");
  });

  it("reativada: a cobrança não cancelada vale mais que a cancelada antiga", () => {
    expect(estadoCobrancaTela([cancelada, ativa])).toBe("ativa");
  });
});
