import { describe, expect, it } from "vitest";
import { ETAPAS_PADRAO } from "@/lib/obras/etapas";

describe("etapas padrão", () => {
  it("tem 23 etapas na ordem do briefing", () => {
    expect(ETAPAS_PADRAO).toHaveLength(23);
    expect(ETAPAS_PADRAO[0]).toBe("Montagem do canteiro de obras");
    expect(ETAPAS_PADRAO[22]).toBe("Limpeza final de obra");
  });
});
