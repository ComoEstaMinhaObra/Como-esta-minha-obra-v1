import { describe, expect, it } from "vitest";
import { EMAIL_EXTRA, PLANOS, TRIAL } from "@/config/pricing";

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
});
