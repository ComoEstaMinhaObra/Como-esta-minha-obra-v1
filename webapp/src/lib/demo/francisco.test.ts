import { describe, expect, it } from "vitest";
import {
  DEMO_FRANCISCO,
  expectativasFinanceirasFrancisco,
} from "@/lib/demo/francisco";

describe("Seed demo Residência de Francisco", () => {
  it("bate aceite S5.6 (contratado, pago, %, saldo, término)", () => {
    const r = expectativasFinanceirasFrancisco();
    expect(r.contratadoTotalCentavos).toBe(103_300_000);
    expect(r.pagoAcumuladoCentavos).toBe(32_300_000);
    expect(r.pctPago).toBe(31);
    expect(r.saldoCentavos).toBe(71_000_000);
    expect(r.terminoPrevisto).toBe("2027-01-30");
  });

  it("etapas: 5×100 + alvenarias 20 + cobertura 20 + elétricas 10", () => {
    expect(DEMO_FRANCISCO.pctEtapas.slice(0, 8)).toEqual([
      100, 100, 100, 100, 100, 20, 20, 10,
    ]);
  });
});
