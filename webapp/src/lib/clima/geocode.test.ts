import { describe, expect, it, vi } from "vitest";
import { geocodificarEndereco, variantesEndereco } from "./geocode";

const semPausa = async () => {};

function resposta(json: unknown, ok = true) {
  return { ok, json: async () => json } as Response;
}

describe("variantesEndereco", () => {
  it("normaliza 'Cidade - UF', expande abreviação e acrescenta o país", () => {
    const v = variantesEndereco("Av. Brasil, 450, Curitiba - PR");
    expect(v[0]).toBe("Avenida Brasil, 450, Curitiba, PR, Brasil");
    expect(v).toContain("Av. Brasil, 450, Curitiba - PR");
  });

  it("termina com a cidade quando o endereço tem logradouro, cidade e UF", () => {
    const v = variantesEndereco("Rua das Palmeiras, 120, Belo Horizonte - MG");
    expect(v.at(-1)).toBe("Belo Horizonte, MG, Brasil");
  });

  it("não duplica o país nem repete variantes iguais", () => {
    const v = variantesEndereco("Rua A, 1, Recife, PE, Brasil");
    expect(v[0]).toBe("Rua A, 1, Recife, PE, Brasil");
    expect(new Set(v).size).toBe(v.length);
  });

  it("endereço vazio não gera consultas", () => {
    expect(variantesEndereco("   ")).toEqual([]);
  });
});

describe("geocodificarEndereco", () => {
  it("usa a primeira variante que retorna resultado", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(resposta([]))
      .mockResolvedValueOnce(resposta([{ lat: "-25.45", lon: "-49.27" }]));
    const geo = await geocodificarEndereco(
      "Av. Brasil, 450, Curitiba - PR",
      fetchFn as never,
      semPausa,
    );
    expect(geo).toEqual({ lat: -25.45, lng: -49.27 });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("restringe ao Brasil", async () => {
    const fetchFn = vi.fn().mockResolvedValue(resposta([{ lat: "1", lon: "2" }]));
    await geocodificarEndereco("Rua A, 1, Recife, PE", fetchFn as never, semPausa);
    expect(String(fetchFn.mock.calls[0][0])).toContain("countrycodes=br");
  });

  it("devolve nulo quando nenhuma variante resolve", async () => {
    const fetchFn = vi.fn().mockResolvedValue(resposta([]));
    expect(
      await geocodificarEndereco("Rua Inexistente, 1, Lugar - ZZ", fetchFn as never, semPausa),
    ).toBeNull();
  });

  it("falha de rede ou resposta de erro não lança", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("rede"))
      .mockResolvedValue(resposta(null, false));
    expect(
      await geocodificarEndereco("Rua A, 1, Recife - PE", fetchFn as never, semPausa),
    ).toBeNull();
  });

  it("espera entre consultas para respeitar o limite do Nominatim", async () => {
    const esperar = vi.fn(async () => {});
    const fetchFn = vi.fn().mockResolvedValue(resposta([]));
    await geocodificarEndereco("Rua A, 1, Recife - PE", fetchFn as never, esperar);
    expect(esperar).toHaveBeenCalledWith(1100);
    expect(esperar.mock.calls.length).toBe(fetchFn.mock.calls.length - 1);
  });
});
