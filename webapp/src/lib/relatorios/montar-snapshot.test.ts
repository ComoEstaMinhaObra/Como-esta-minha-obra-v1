import { describe, expect, it } from "vitest";
import { montarSnapshotRelatorioEmMemoria } from "@/lib/relatorios/montar-snapshot";
import type { RelatorioRascunho } from "@/lib/relatorios/tipos";

const obra = {
  nome: "Casa Horizonte",
  endereco: "Rua das Flores, 10",
  clienteNome: "Marina",
  construtora: null,
  engenheiro: "Carlos",
  escritorioArquitetura: null,
  arquiteto: null,
  projetistaEstruturas: null,
  projetistaInstalacoes: null,
  inicioContratual: "2026-01-01",
  terminoContratual: "2026-12-31",
  valorContratadoCentavos: 100_000_000,
};

const rascunho: RelatorioRascunho = {
  versao: 1,
  etapas: [
    { etapaId: "estrutura", pct: 100 },
    { etapaId: "alvenaria", pct: 50 },
  ],
  financeiro: {
    medicoes: [{ valorCentavos: 5_000_000 }],
    materiais: [{ rotulo: "Cimento", valorCentavos: 1_000_000 }],
    aditivos: [{ descricao: "Muro lateral", valorCentavos: 2_000_000 }],
    supressoes: [],
    estornos: [],
  },
  atividades: [
    {
      etapaId: "alvenaria",
      nota: "Paredes do pavimento concluídas.",
      fotosPaths: ["obra/relatorio/alvenaria.webp"],
    },
  ],
  prazo: [{ motivo: "chuvas", dias: 5 }],
};

describe("montarSnapshotRelatorioEmMemoria", () => {
  it("projeta o rascunho sem persistir e preserva os rótulos do envio", () => {
    const resultado = montarSnapshotRelatorioEmMemoria({
      numero: 4,
      enviadoEm: "2026-08-18T12:00:00.000Z",
      obra,
      etapas: [
        { id: "estrutura", nome: "Estrutura", peso: 1, pctAtual: 100 },
        { id: "alvenaria", nome: "Alvenaria", peso: 1, pctAtual: 20 },
      ],
      lancamentos: [
        {
          tipo: "medicao",
          grupo: "medicoes",
          rotulo: "Medição 03",
          valorCentavos: 10_000_000,
          numero: 3,
          relatorioId: "rel-1",
        },
      ],
      diasAditivados: [{ motivo: "licencas", descricao: null, dias: 10 }],
      climaDias: [],
      rascunho,
    });

    expect(resultado.snapshot.avancoFisico).toMatchObject({
      geralAntes: 60,
      geralDepois: 75,
    });
    expect(resultado.snapshot.financeiro).toMatchObject({
      contratadoTotalCentavos: 102_000_000,
      pagoAcumuladoCentavos: 16_000_000,
      pctPago: 16,
    });
    expect(
      resultado.snapshot.financeiro.lancamentosNovos.map((item) => item.rotulo),
    ).toEqual(["Medição 04", "Cimento", "Aditivo 01 — Muro lateral"]);
    expect(resultado.snapshot.prazo).toMatchObject({
      totalDiasAditivados: 15,
      novaDataTermino: "2027-01-15",
    });
    expect(resultado.snapshot.atividades[0]).toEqual({
      etapaNome: "Alvenaria",
      nota: "Paredes do pavimento concluídas.",
      fotosPaths: ["obra/relatorio/alvenaria.webp"],
    });
    expect(rascunho.etapas[1].pct).toBe(50);
  });

  const etapasBase = [
    { id: "estrutura", nome: "Estrutura", peso: 1, pctAtual: 100 },
    { id: "alvenaria", nome: "Alvenaria", peso: 1, pctAtual: 20 },
  ];
  const semFinanceiro: RelatorioRascunho["financeiro"] = {
    medicoes: [],
    materiais: [],
    aditivos: [],
    supressoes: [],
    estornos: [],
  };
  const montar = (
    lancamentos: Parameters<typeof montarSnapshotRelatorioEmMemoria>[0]["lancamentos"],
    financeiro: Partial<RelatorioRascunho["financeiro"]>,
    valorContratadoCentavos = 100_000_000,
  ) =>
    montarSnapshotRelatorioEmMemoria({
      numero: 2,
      enviadoEm: "2026-08-18T12:00:00.000Z",
      obra: { ...obra, valorContratadoCentavos },
      etapas: etapasBase,
      lancamentos,
      diasAditivados: [],
      climaDias: [],
      rascunho: {
        ...rascunho,
        atividades: [],
        prazo: [],
        financeiro: { ...semFinanceiro, ...financeiro },
      },
    });

  it("inclui o sinal no primeiro relatório, antes das medições, sem somá-lo duas vezes", () => {
    const r = montar(
      [
        {
          id: "sinal",
          tipo: "sinal",
          grupo: "medicoes",
          rotulo: "Sinal",
          valorCentavos: 10_000_000,
          numero: null,
          relatorioId: null,
        },
      ],
      { medicoes: [{ valorCentavos: 5_000_000 }] },
    );
    expect(
      r.snapshot.financeiro.lancamentosNovos.map((l) => l.rotulo),
    ).toEqual(["Sinal", "Medição 01"]);
    expect(r.snapshot.financeiro.pagoAcumuladoCentavos).toBe(15_000_000);
  });

  it("não repete o sinal já vinculado a um relatório", () => {
    const r = montar(
      [
        {
          id: "sinal",
          tipo: "sinal",
          grupo: "medicoes",
          rotulo: "Sinal",
          valorCentavos: 10_000_000,
          numero: null,
          relatorioId: "rel-1",
        },
      ],
      {},
    );
    expect(r.snapshot.financeiro.lancamentosNovos).toEqual([]);
    expect(r.snapshot.financeiro.pagoAcumuladoCentavos).toBe(10_000_000);
  });

  it("supressão reduz o contratado abaixo do original e numera em sequência", () => {
    const r = montar(
      [
        {
          id: "s1",
          tipo: "supressao",
          grupo: "supressoes",
          rotulo: "Supressão 01 — Piscina",
          valorCentavos: 10_000_000,
          numero: 1,
          relatorioId: "rel-1",
        },
      ],
      { supressoes: [{ descricao: "Garagem", valorCentavos: 20_000_000 }] },
    );
    expect(
      r.snapshot.financeiro.lancamentosNovos.map((l) => l.rotulo),
    ).toEqual(["Supressão 02 — Garagem"]);
    expect(r.snapshot.financeiro).toMatchObject({
      supressoesAcumuladoCentavos: 30_000_000,
      contratadoTotalCentavos: 70_000_000,
    });
  });

  it("supressão com devolução no mesmo relatório valida o estado final", () => {
    const r = montar(
      [
        {
          id: "m1",
          tipo: "medicao",
          grupo: "medicoes",
          rotulo: "Medição 01",
          valorCentavos: 80_000_000,
          numero: 1,
          relatorioId: "rel-1",
        },
      ],
      {
        supressoes: [{ descricao: "Garagem", valorCentavos: 30_000_000 }],
        estornos: [
          { origemId: "m1", descricao: "Devolução", valorCentavos: 10_000_000 },
        ],
      },
    );
    expect(r.snapshot.financeiro).toMatchObject({
      contratadoTotalCentavos: 70_000_000,
      pagoAcumuladoCentavos: 70_000_000,
    });
  });

  it("estorno parcial e total reduzem o pago; estorno de aditivo reduz o contratado", () => {
    const lancamentos = [
      {
        id: "m1",
        tipo: "medicao",
        grupo: "medicoes",
        rotulo: "Medição 01",
        valorCentavos: 10_000_000,
        numero: 1,
        relatorioId: "rel-1",
      },
      {
        id: "a1",
        tipo: "aditivo",
        grupo: "aditivos",
        rotulo: "Aditivo 01 — Muro",
        valorCentavos: 4_000_000,
        numero: 1,
        relatorioId: "rel-1",
      },
    ];
    const parcial = montar(lancamentos, {
      estornos: [{ origemId: "m1", descricao: "Ajuste", valorCentavos: 2_500_000 }],
    });
    expect(parcial.snapshot.financeiro.pagoAcumuladoCentavos).toBe(7_500_000);
    expect(parcial.lancamentosNovos[0]).toMatchObject({
      tipo: "estorno",
      grupo: "medicoes",
      valorCentavos: -2_500_000,
      origemId: "m1",
    });

    const total = montar(lancamentos, {
      estornos: [{ origemId: "a1", descricao: "Cancelado", valorCentavos: 4_000_000 }],
    });
    expect(total.snapshot.financeiro.contratadoTotalCentavos).toBe(100_000_000);
    expect(total.snapshot.financeiro.pagoAcumuladoCentavos).toBe(10_000_000);
  });

  it("rejeita estorno acima da origem, somando os já existentes", () => {
    const lancamentos = [
      {
        id: "m1",
        tipo: "medicao",
        grupo: "medicoes",
        rotulo: "Medição 01",
        valorCentavos: 10_000_000,
        numero: 1,
        relatorioId: "rel-1",
      },
      {
        id: "e1",
        tipo: "estorno",
        grupo: "medicoes",
        rotulo: "Estorno — parte",
        valorCentavos: -6_000_000,
        numero: null,
        relatorioId: "rel-1",
        origemId: "m1",
      },
    ];
    expect(() =>
      montar(lancamentos, {
        estornos: [{ origemId: "m1", descricao: "x", valorCentavos: 4_000_001 }],
      }),
    ).toThrow("ESTORNO_ACIMA_ORIGEM");
    expect(() =>
      montar(lancamentos, {
        estornos: [{ origemId: "inexistente", descricao: "x", valorCentavos: 1 }],
      }),
    ).toThrow("ESTORNO_ORIGEM_INVALIDA");
  });

  it("rejeita regressão de avanço antes do preview", () => {
    expect(() =>
      montarSnapshotRelatorioEmMemoria({
        numero: 1,
        enviadoEm: "2026-08-18T12:00:00.000Z",
        obra,
        etapas: [{ id: "estrutura", nome: "Estrutura", peso: 1, pctAtual: 80 }],
        lancamentos: [],
        diasAditivados: [],
        climaDias: [],
        rascunho: { ...rascunho, etapas: [{ etapaId: "estrutura", pct: 70 }] },
      }),
    ).toThrow("PCT_REGREDIU");
  });
});
