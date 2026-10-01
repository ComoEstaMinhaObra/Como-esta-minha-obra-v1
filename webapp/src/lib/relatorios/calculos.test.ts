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
  calcularFinanceiroProjetado,
  calcularNovaDataTermino,
  calcularSaldoEstornavel,
  pctMonotonicoValido,
  problemasFinanceiros,
  proximoRotuloMedicao,
  proximoRotuloSupressao,
  validarInvariantesFinanceiras,
} from "@/lib/relatorios/calculos";
import type {
  LancamentoPersistido,
  RelatorioRascunho,
} from "@/lib/relatorios/tipos";

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

describe("F — supressão, estornos vinculados e invariantes", () => {
  const lanc = (
    over: Partial<LancamentoPersistido> & Pick<LancamentoPersistido, "id" | "tipo">,
  ): LancamentoPersistido => ({
    grupo: "medicoes",
    rotulo: over.id,
    valorCentavos: 0,
    numero: null,
    relatorioId: "rel-1",
    origemId: null,
    ...over,
  });
  const vazio: RelatorioRascunho["financeiro"] = {
    medicoes: [],
    materiais: [],
    aditivos: [],
    supressoes: [],
    estornos: [],
  };
  const base = [
    lanc({ id: "sinal", tipo: "sinal", valorCentavos: 10_000_000, relatorioId: null }),
    lanc({ id: "m1", tipo: "medicao", valorCentavos: 20_000_000, numero: 1 }),
  ];

  it("supressão reduz o contratado abaixo do original", () => {
    const r = calcularFinanceiro({
      valorContratadoCentavos: 100_000_000,
      aditivosCentavos: [],
      supressoesCentavos: [40_000_000],
      pagoCentavos: [30_000_000],
    });
    expect(r.contratadoTotalCentavos).toBe(60_000_000);
    expect(r.supressoesAcumuladoCentavos).toBe(40_000_000);
    expect(r.pctPago).toBe(50);
  });

  it("invariantes: contratado > 0, pago >= 0 e pago <= contratado", () => {
    expect(
      validarInvariantesFinanceiras({ contratadoTotalCentavos: 0, pagoAcumuladoCentavos: 0 }),
    ).toBe("CONTRATADO_INVALIDO");
    expect(
      validarInvariantesFinanceiras({ contratadoTotalCentavos: 100, pagoAcumuladoCentavos: -1 }),
    ).toBe("PAGO_NEGATIVO");
    expect(
      validarInvariantesFinanceiras({ contratadoTotalCentavos: 100, pagoAcumuladoCentavos: 101 }),
    ).toBe("PAGO_ACIMA_CONTRATADO");
    expect(
      validarInvariantesFinanceiras({ contratadoTotalCentavos: 100, pagoAcumuladoCentavos: 100 }),
    ).toBeNull();
  });

  it("supressão sem devolução deixa o pago acima do contratado; com devolução passa", () => {
    const params = { valorContratadoCentavos: 50_000_000, lancamentos: base };
    expect(
      problemasFinanceiros({
        ...params,
        financeiro: {
          ...vazio,
          supressoes: [{ descricao: "Garagem", valorCentavos: 25_000_000 }],
        },
      }),
    ).toContain("PAGO_ACIMA_CONTRATADO");
    expect(
      problemasFinanceiros({
        ...params,
        financeiro: {
          ...vazio,
          supressoes: [{ descricao: "Garagem", valorCentavos: 25_000_000 }],
          estornos: [{ origemId: "m1", descricao: "Devolução", valorCentavos: 5_000_000 }],
        },
      }),
    ).toEqual([]);
  });

  it("supressão que zera o contratado é bloqueada", () => {
    expect(
      problemasFinanceiros({
        valorContratadoCentavos: 30_000_000,
        lancamentos: base,
        financeiro: {
          ...vazio,
          supressoes: [{ descricao: "Tudo", valorCentavos: 30_000_000 }],
        },
      }),
    ).toContain("CONTRATADO_INVALIDO");
  });

  it("estorno acima do saldo da origem e valores zerados são reportados", () => {
    const params = { valorContratadoCentavos: 100_000_000, lancamentos: base };
    const acima = problemasFinanceiros({
      ...params,
      financeiro: {
        ...vazio,
        estornos: [
          { origemId: "m1", descricao: "a", valorCentavos: 15_000_000 },
          { origemId: "m1", descricao: "b", valorCentavos: 5_000_001 },
        ],
      },
    });
    expect(acima).toContain("ESTORNO_ACIMA_ORIGEM");
    expect(
      problemasFinanceiros({
        ...params,
        financeiro: { ...vazio, medicoes: [{ valorCentavos: 0 }] },
      }),
    ).toContain("VALOR_INVALIDO");
    expect(
      problemasFinanceiros({
        ...params,
        financeiro: {
          ...vazio,
          estornos: [{ origemId: "nao-existe", descricao: "a", valorCentavos: 1 }],
        },
      }),
    ).toContain("ESTORNO_SEM_ORIGEM");
  });

  it("saldo estornável desconta estornos parciais já persistidos", () => {
    const saldos = calcularSaldoEstornavel([
      ...base,
      lanc({
        id: "e1",
        tipo: "estorno",
        valorCentavos: -5_000_000,
        origemId: "m1",
      }),
    ]);
    expect(saldos.find((s) => s.id === "m1")).toMatchObject({
      estornadoCentavos: 5_000_000,
      saldoCentavos: 15_000_000,
    });
    expect(saldos.map((s) => s.id)).toEqual(["sinal", "m1"]);
  });

  it("estorno de aditivo reduz o contratado e não o pago", () => {
    const r = calcularFinanceiroProjetado({
      valorContratadoCentavos: 100_000_000,
      lancamentos: [
        ...base,
        lanc({ id: "a1", tipo: "aditivo", grupo: "aditivos", valorCentavos: 8_000_000, numero: 1 }),
      ],
      financeiro: {
        ...vazio,
        estornos: [{ origemId: "a1", descricao: "cancelado", valorCentavos: 3_000_000 }],
      },
    });
    expect(r.contratadoTotalCentavos).toBe(105_000_000);
    expect(r.pagoAcumuladoCentavos).toBe(30_000_000);
  });

  it("rótulo da próxima supressão", () => {
    expect(proximoRotuloSupressao(1, 1)).toBe("Supressão 03");
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
