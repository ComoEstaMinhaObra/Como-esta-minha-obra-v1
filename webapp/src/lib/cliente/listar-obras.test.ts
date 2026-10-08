import { describe, expect, it } from "vitest";
import { parsearObrasProprietario } from "./listar-obras";

describe("parsearObrasProprietario", () => {
  it("aceita resumo publicado e mantém ausência de snapshot explícita", () => {
    const obras = parsearObrasProprietario([
      {
        id: "11111111-1111-4111-8111-111111111111",
        nome: "Casa Atlântico",
        endereco: "Rua A, 1",
        avanco: 42.4,
        inicioContratual: "2026-01-01",
        entregaPrevista: "2026-12-10",
        ultimoRelatorioNumero: 2,
        ultimoRelatorioEm: "2026-10-01T12:00:00Z",
        temRelatorioPublicado: true,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        nome: "Apartamento Centro",
        endereco: null,
        avanco: null,
        inicioContratual: null,
        entregaPrevista: null,
        ultimoRelatorioNumero: null,
        ultimoRelatorioEm: null,
        temRelatorioPublicado: false,
      },
    ]);

    expect(obras).toHaveLength(2);
    expect(obras?.[0]?.avanco).toBe(42);
    expect(obras?.[1]).toMatchObject({
      nome: "Apartamento Centro",
      avanco: null,
      temRelatorioPublicado: false,
    });
  });

  it("rejeita uma resposta incompleta em vez de convertê-la em lista vazia", () => {
    expect(
      parsearObrasProprietario([
        { id: "11111111-1111-4111-8111-111111111111", nome: "Obra" },
      ]),
    ).toBeNull();
  });
});
