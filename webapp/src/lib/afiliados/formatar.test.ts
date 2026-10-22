import { describe, expect, it } from "vitest";
import {
  bpsParaPercentual,
  descreverComissao,
  descreverDesconto,
  formatarBps,
  percentualParaBps,
  reaisTextoParaCentavos,
} from "./formatar";

describe("formatarBps", () => {
  it("formata percentuais inteiros e fracionados", () => {
    expect(formatarBps(2000)).toBe("20%");
    expect(formatarBps(1250)).toBe("12,5%");
    expect(formatarBps(0)).toBe("0%");
  });
});

describe("descreverDesconto", () => {
  it("descreve a duração", () => {
    expect(descreverDesconto(2000, "primeira_fatura")).toBe(
      "20% de desconto na primeira fatura",
    );
    expect(descreverDesconto(1000, "permanente")).toBe(
      "10% de desconto em todas as faturas",
    );
  });

  it("devolve null sem desconto", () => {
    expect(descreverDesconto(0, null)).toBeNull();
    expect(descreverDesconto(1000, null)).toBeNull();
  });
});

describe("descreverComissao", () => {
  it("diferencia vitalícia de primeira fatura", () => {
    expect(descreverComissao(2000, true)).toBe("20% de todos os pagamentos");
    expect(descreverComissao(1000, false)).toBe("10% da primeira fatura");
  });
});

describe("percentualParaBps", () => {
  it.each([
    ["20", 2000],
    ["12,5", 1250],
    ["12.5", 1250],
    [" 7,25% ", 725],
    ["0", 0],
    ["100", 10000],
  ])("converte %s", (texto, bps) => {
    expect(percentualParaBps(texto)).toBe(bps);
  });

  it.each(["", "abc", "-5", "1,234", "1e3"])("rejeita %s", (texto) => {
    expect(percentualParaBps(texto)).toBeNull();
  });
});

describe("bpsParaPercentual", () => {
  it("volta para o texto do campo", () => {
    expect(bpsParaPercentual(2000)).toBe("20");
    expect(bpsParaPercentual(1250)).toBe("12,5");
  });
});

describe("reaisTextoParaCentavos", () => {
  it.each([
    ["50", 5000],
    ["50,00", 5000],
    ["R$ 1.234,50", 123450],
    ["0", 0],
    ["7,5", 750],
  ])("converte %s", (texto, centavos) => {
    expect(reaisTextoParaCentavos(texto)).toBe(centavos);
  });

  it.each(["", "abc", "-1", "1,234"])("rejeita %s", (texto) => {
    expect(reaisTextoParaCentavos(texto)).toBeNull();
  });
});
