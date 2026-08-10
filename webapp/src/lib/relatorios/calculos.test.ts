import { describe, expect, it } from "vitest";
import { formatarBRLCompacto } from "@/lib/formatacao";
import {
  podeAdicionarEmailExtra,
  podeCriarObra,
  podeEditarRascunho,
  podeEnviarRelatorio,
  podeVerSomenteLeitura,
  type EstadoAssinatura,
} from "@/lib/gating";
import {
  calcularAvancoGeral,
  calcularFinanceiro,
  calcularNovaDataTermino,
  pctMonotonicoValido,
  proximoRotuloMedicao,
} from "@/lib/relatorios/calculos";

const etapasPlanilha = [
  ...Array.from({ length: 5 }, () => ({ peso: 1, pct: 100 })),
  { peso: 1, pct: 20 },
  { peso: 1, pct: 20 },
  { peso: 1, pct: 10 },
  ...Array.from({ length: 15 }, () => ({ peso: 1, pct: 0 })),
];

describe("A — avanço geral", () => {
  it("A1 média ponderada pesos 1 → 24", () => {
    expect(calcularAvancoGeral(etapasPlanilha)).toBe(24);
  });

  it("A2 Estrutura peso 5 → 35", () => {
    const etapas = etapasPlanilha.map((e, i) =>
      i === 4 ? { peso: 5, pct: 100 } : e,
    );
    expect(calcularAvancoGeral(etapas)).toBe(35);
  });

  it("A3 extremos", () => {
    expect(
      calcularAvancoGeral(Array.from({ length: 23 }, () => ({ peso: 1, pct: 100 }))),
    ).toBe(100);
    expect(
      calcularAvancoGeral(Array.from({ length: 23 }, () => ({ peso: 1, pct: 0 }))),
    ).toBe(0);
    expect(calcularAvancoGeral([])).toBe(0);
  });
});

describe("F — financeiro", () => {
  it("F1 agregados Francisco", () => {
    const r = calcularFinanceiro({
      valorContratadoCentavos: 100_000_000,
      aditivosCentavos: [3_000_000, 300_000],
      pagoCentavos: [
        10_000_000,
        5_000_000,
        6_000_000,
        5_000_000,
        2_300_000,
        1_200_000,
        2_000_000,
        800_000,
      ],
    });
    expect(r.contratadoTotalCentavos).toBe(103_300_000);
    expect(r.pagoAcumuladoCentavos).toBe(32_300_000);
    expect(r.pctPago).toBe(31);
    expect(r.saldoCentavos).toBe(71_000_000);
  });

  it("F2 próximos rótulos", () => {
    expect(proximoRotuloMedicao(3, 0)).toBe("Medição 04");
    expect(proximoRotuloMedicao(3, 2)).toBe("Medição 06");
  });

  it("F3 estornos", () => {
    const basePago = [
      10_000_000, 5_000_000, 6_000_000, 5_000_000, 2_300_000, 1_200_000,
      2_000_000, 800_000, -500_000,
    ];
    const r = calcularFinanceiro({
      valorContratadoCentavos: 100_000_000,
      aditivosCentavos: [3_000_000, 300_000],
      pagoCentavos: basePago,
    });
    expect(r.pagoAcumuladoCentavos).toBe(31_800_000);
    expect(r.pctPago).toBe(31);

    const r2 = calcularFinanceiro({
      valorContratadoCentavos: 100_000_000,
      aditivosCentavos: [3_000_000, 300_000],
      pagoCentavos: [
        10_000_000, 5_000_000, 6_000_000, 5_000_000, 2_300_000, 1_200_000,
        2_000_000, 800_000,
      ],
      estornosAditivosCentavos: [-500_000],
    });
    expect(r2.contratadoTotalCentavos).toBe(102_800_000);
  });
});

describe("P / M / BRL", () => {
  it("P1 término + dias", () => {
    expect(calcularNovaDataTermino("2026-12-31", [18, 12])).toBe("2027-01-30");
  });

  it("M1 monotonicidade", () => {
    expect(pctMonotonicoValido(60, 55)).toBe(false);
    expect(pctMonotonicoValido(60, 60)).toBe(true);
    expect(pctMonotonicoValido(60, 61)).toBe(true);
  });

  it("BRL compacto", () => {
    expect(formatarBRLCompacto(47_300_000)).toBe("R$ 473 mil");
    expect(formatarBRLCompacto(103_300_000)).toBe("R$ 1,03 mi");
    expect(formatarBRLCompacto(89_900)).toBe("R$ 899,00");
  });
});

describe("Gating 5.5", () => {
  const base = (over: Partial<EstadoAssinatura>): EstadoAssinatura => ({
    status: "trial",
    limiteObras: 1,
    obrasAtivas: 0,
    trialFim: new Date(Date.now() + 7 * 86400000),
    relatoriosEnviadosTrial: 0,
    ...over,
  });

  it("matriz", () => {
    expect(podeCriarObra(base({ status: "trial", obrasAtivas: 0 }))).toBe(true);
    expect(podeCriarObra(base({ status: "trial", obrasAtivas: 1 }))).toBe(false);
    expect(podeCriarObra(base({ status: "ativa", limiteObras: 3, obrasAtivas: 2 }))).toBe(true);
    expect(podeCriarObra(base({ status: "inadimplente" }))).toBe(false);
    expect(podeCriarObra(base({ status: "cancelada" }))).toBe(false);

    expect(podeEditarRascunho(base({ status: "trial" }))).toBe(true);
    expect(podeEditarRascunho(base({ status: "ativa" }))).toBe(true);
    expect(podeEditarRascunho(base({ status: "inadimplente" }))).toBe(false);

    expect(podeEnviarRelatorio(base({ status: "trial", relatoriosEnviadosTrial: 0 }))).toBe(true);
    expect(podeEnviarRelatorio(base({ status: "trial", relatoriosEnviadosTrial: 1 }))).toBe(false);
    expect(
      podeEnviarRelatorio(
        base({ status: "trial", trialFim: new Date(Date.now() - 1000) }),
      ),
    ).toBe(false);
    expect(podeEnviarRelatorio(base({ status: "ativa" }))).toBe(true);
    expect(podeEnviarRelatorio(base({ status: "cancelada" }))).toBe(false);

    expect(podeAdicionarEmailExtra(base({ status: "trial" }))).toBe(false);
    expect(podeAdicionarEmailExtra(base({ status: "ativa" }))).toBe(true);

    expect(podeVerSomenteLeitura(base({ status: "cancelada" }))).toBe(true);
  });
});
