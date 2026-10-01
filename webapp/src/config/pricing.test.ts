import { describe, expect, it } from "vitest";
import {
  EMAIL_ADICIONAL,
  EMAIL_EXTRA,
  OBRA_ATIVA,
  PLANOS,
  TRIAL,
  calcularTotalMensal,
} from "@/config/pricing";

describe("pricing", () => {
  it("reflete os preços das variáveis de ambiente (centavos)", () => {
    expect(PLANOS).toEqual([
      {
        id: "obra_1",
        nome: "1 obra",
        precoCentavos: 12990,
        limiteObras: 1,
        externalId: "plano-1-obra-v1",
      },
      {
        id: "obra_3",
        nome: "3 obras",
        precoCentavos: 31990,
        limiteObras: 3,
        externalId: "plano-3-obras-v1",
      },
      {
        id: "obra_5",
        nome: "5 obras",
        precoCentavos: 49990,
        limiteObras: 5,
        externalId: "plano-5-obras-v1",
      },
    ]);

    expect(EMAIL_EXTRA).toEqual({
      nome: "E-mail extra",
      precoCentavos: 2990,
      externalId: "email-extra-v1",
    });

    expect(TRIAL).toEqual({
      dias: 14,
      limiteRelatorios: 1,
      limiteObras: 1,
    });
  });

  it("define os produtos da cobrança por obra", () => {
    expect(OBRA_ATIVA).toEqual({
      nome: "Obra ativa",
      precoCentavos: 12990,
      externalId: "obra-ativa-v2",
    });
    expect(EMAIL_ADICIONAL).toEqual({
      nome: "E-mail adicional",
      precoCentavos: 2990,
      externalId: "email-adicional-v2",
    });
  });

  it("calcula o total mensal como soma das faturas (decisões 2.1)", () => {
    expect(calcularTotalMensal(1)).toBe(12990);
    expect(calcularTotalMensal(2)).toBe(25980);
    expect(calcularTotalMensal(3)).toBe(38970);
    expect(calcularTotalMensal(4)).toBe(51960);
    expect(calcularTotalMensal(5)).toBe(64950);
    expect(calcularTotalMensal(2, 3)).toBe(25980 + 3 * 2990);
    expect(calcularTotalMensal(0)).toBe(0);
  });

  it("rejeita quantidades inválidas", () => {
    expect(() => calcularTotalMensal(-1)).toThrow();
    expect(() => calcularTotalMensal(1.5)).toThrow();
    expect(() => calcularTotalMensal(1, -1)).toThrow();
  });
});
