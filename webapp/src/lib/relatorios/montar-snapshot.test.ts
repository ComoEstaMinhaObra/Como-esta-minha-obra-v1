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
