import { describe, expect, it } from "vitest";
import { normalizarCodigo } from "./codigo";

describe("normalizarCodigo", () => {
  it("normaliza caixa e espaços", () => {
    expect(normalizarCodigo("  Promo-Joao ")).toBe("promo-joao");
  });

  it("aceita letras, números e hífen no meio", () => {
    expect(normalizarCodigo("joao2026")).toBe("joao2026");
    expect(normalizarCodigo("a-b")).toBe("a-b");
  });

  it.each([
    ["curto demais", "ab"],
    ["longo demais", "a".repeat(33)],
    ["hífen na ponta", "-promo"],
    ["hífen no fim", "promo-"],
    ["caractere inválido", "promo_joao"],
    ["com barra", "promo/joao"],
    ["vazio", ""],
  ])("rejeita código %s", (_motivo, valor) => {
    expect(normalizarCodigo(valor)).toBeNull();
  });

  it("rejeita ausente", () => {
    expect(normalizarCodigo(undefined)).toBeNull();
    expect(normalizarCodigo(null)).toBeNull();
  });
});
