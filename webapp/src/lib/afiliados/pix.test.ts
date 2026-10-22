import { describe, expect, it } from "vitest";
import { cnpjValido, cpfValido, formatarChavePix, normalizarChavePix } from "./pix";

describe("cpfValido / cnpjValido", () => {
  it("aceita documentos válidos, com ou sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
  });

  it("rejeita dígito verificador errado, repetidos e tamanho errado", () => {
    expect(cpfValido("529.982.247-24")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("123")).toBe(false);
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("00.000.000/0000-00")).toBe(false);
  });
});

describe("normalizarChavePix", () => {
  it("normaliza CPF e CNPJ para dígitos", () => {
    expect(normalizarChavePix("cpf", " 529.982.247-25 ")).toEqual({ ok: true, chave: "52998224725" });
    expect(normalizarChavePix("cnpj", "11.222.333/0001-81")).toEqual({ ok: true, chave: "11222333000181" });
  });

  it("rejeita CPF com dígito errado", () => {
    expect(normalizarChavePix("cpf", "529.982.247-24")).toEqual({ ok: false, erro: "CPF inválido." });
  });

  it("e-mail e chave aleatória ficam em minúsculas", () => {
    expect(normalizarChavePix("email", " Maria@Exemplo.COM ")).toEqual({
      ok: true,
      chave: "maria@exemplo.com",
    });
    expect(
      normalizarChavePix("aleatoria", "123E4567-E89B-12D3-A456-426614174000"),
    ).toEqual({ ok: true, chave: "123e4567-e89b-12d3-a456-426614174000" });
    expect(normalizarChavePix("email", "sem-arroba").ok).toBe(false);
    expect(normalizarChavePix("aleatoria", "abc").ok).toBe(false);
  });

  it("telefone vira +55 com DDD", () => {
    expect(normalizarChavePix("telefone", "(11) 99999-9999")).toEqual({ ok: true, chave: "+5511999999999" });
    expect(normalizarChavePix("telefone", "+55 11 3333-4444")).toEqual({ ok: true, chave: "+551133334444" });
    expect(normalizarChavePix("telefone", "5511999999999")).toEqual({ ok: true, chave: "+5511999999999" });
    expect(normalizarChavePix("telefone", "9999")).toMatchObject({ ok: false });
  });

  it("o formato normalizado passa na checagem do banco", () => {
    // mesmas regras de fn_afiliado_solicitar_saque
    expect(normalizarChavePix("telefone", "(11) 99999-9999")).toMatchObject({
      chave: expect.stringMatching(/^\+?[0-9]{10,13}$/),
    });
  });
});

describe("formatarChavePix", () => {
  it("aplica máscara para o suporte ler", () => {
    expect(formatarChavePix("cpf", "52998224725")).toBe("529.982.247-25");
    expect(formatarChavePix("cnpj", "11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarChavePix("telefone", "+5511999999999")).toBe("+55 (11) 99999-9999");
    expect(formatarChavePix("email", "a@b.com")).toBe("a@b.com");
  });
});
