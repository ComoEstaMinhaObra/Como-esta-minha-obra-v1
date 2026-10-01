import { describe, expect, it } from "vitest";
import { avaliarSenha, senhaAceita } from "@/lib/auth/forca-senha";

describe("força da senha", () => {
  it("trata campo vazio como sem nível", () => {
    expect(avaliarSenha("")).toEqual({ nivel: "vazia", faltando: [] });
    expect(senhaAceita("")).toBe(false);
  });

  it("é fraca com menos de 8 caracteres ou sem minúscula, maiúscula e número", () => {
    expect(avaliarSenha("Ab1").nivel).toBe("fraca");
    expect(avaliarSenha("abcdefghij").faltando).toEqual([
      "uma letra maiúscula",
      "um número",
    ]);
    expect(avaliarSenha("ABCDEFGH1").faltando).toEqual(["uma letra minúscula"]);
    expect(avaliarSenha("Abcdefgh").faltando).toEqual(["um número"]);
    expect(senhaAceita("Abcdefgh")).toBe(false);
  });

  it("é média com 8+ caracteres, minúscula, maiúscula e número", () => {
    expect(avaliarSenha("Tijolo42x")).toEqual({ nivel: "media", faltando: [] });
    expect(senhaAceita("Tijolo42x")).toBe(true);
  });

  it("é forte com símbolo ou 12+ caracteres", () => {
    expect(avaliarSenha("Tijolo42!").nivel).toBe("forte");
    expect(avaliarSenha("TijoloCimento42").nivel).toBe("forte");
    expect(senhaAceita("Tijolo42!")).toBe(true);
  });

  it("rejeita senhas comuns mesmo com as classes exigidas", () => {
    expect(avaliarSenha("Senha123").nivel).toBe("fraca");
    expect(avaliarSenha("Password1!").nivel).toBe("fraca");
    expect(senhaAceita("Senha123")).toBe(false);
  });

  it("rejeita senhas com poucos caracteres distintos", () => {
    expect(avaliarSenha("Aaaaaaa1").nivel).toBe("fraca");
  });
});
