import { describe, expect, it } from "vitest";
import {
  pesoDigitadoParaNumero,
  sanitizarPesoDigitado,
  validarEtapasSelecionadas,
} from "@/lib/obras/pesos-etapas";

describe("pesos das etapas", () => {
  it("aceita vírgula ou ponto e limita a duas casas decimais", () => {
    expect(sanitizarPesoDigitado("12,345%")).toBe("12,34");
    expect(sanitizarPesoDigitado("7.5")).toBe("7,5");
    expect(pesoDigitadoParaNumero("7,5")).toBe(7.5);
  });

  it("exige etapas com pesos positivos que totalizem exatamente 100%", () => {
    expect(
      validarEtapasSelecionadas([
        { nome: "Estrutura", peso: 33.33 },
        { nome: "Acabamentos", peso: 66.67 },
      ]),
    ).toBe(true);
    expect(
      validarEtapasSelecionadas([
        { nome: "Estrutura", peso: 100 },
        { nome: "Acabamentos", peso: 0 },
      ]),
    ).toBe(false);
    expect(
      validarEtapasSelecionadas([{ nome: "Estrutura", peso: 99.99 }]),
    ).toBe(false);
  });

  it("recusa pesos com mais de duas casas decimais", () => {
    expect(
      validarEtapasSelecionadas([
        { nome: "Estrutura", peso: 33.333 },
        { nome: "Acabamentos", peso: 66.667 },
      ]),
    ).toBe(false);
  });
});
