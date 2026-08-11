import { describe, expect, it } from "vitest";
import {
  calcularProbChuva,
  mapearCodigoWmo,
  buscarDiasOpenMeteo,
} from "./open-meteo";

describe("clima WMO", () => {
  it("mapeia códigos para condição", () => {
    expect(mapearCodigoWmo(0)).toBe("aberto");
    expect(mapearCodigoWmo(1)).toBe("aberto");
    expect(mapearCodigoWmo(3)).toBe("nublado");
    expect(mapearCodigoWmo(45)).toBe("nublado");
    expect(mapearCodigoWmo(61)).toBe("chuvoso");
  });

  it("deriva prob de precipitation_sum quando falta probabilidade", () => {
    expect(calcularProbChuva(null, 4.2)).toBe(80);
    expect(calcularProbChuva(null, 0.5)).toBe(10);
    expect(calcularProbChuva(55, 0)).toBe(55);
  });

  it("parseia resposta Open-Meteo", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          daily: {
            time: ["2026-08-09", "2026-08-10"],
            weather_code: [0, 61],
            precipitation_probability_max: [null, 70],
            precipitation_sum: [4.2, 2.0],
          },
        }),
        { status: 200 },
      );

    const dias = await buscarDiasOpenMeteo(-12.9, -38.5, fetchFn);
    expect(dias).toHaveLength(2);
    expect(dias[0]).toEqual({
      data: "2026-08-09",
      condicao: "aberto",
      probChuva: 80,
    });
    expect(dias[1]).toEqual({
      data: "2026-08-10",
      condicao: "chuvoso",
      probChuva: 70,
    });
  });
});
