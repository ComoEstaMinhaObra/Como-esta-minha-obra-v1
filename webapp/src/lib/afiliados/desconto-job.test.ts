import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssinaturaMp } from "@/lib/mercadopago";
import { executarReversaoDescontos } from "./desconto-job";

vi.mock("@/lib/log", () => ({ logSeguro: vi.fn(), sanitizarErro: () => "erro" }));
vi.mock("@/lib/mercadopago", () => ({
  consultarAssinatura: vi.fn(),
  atualizarValorAssinatura: vi.fn(),
}));

const OBRA = "11111111-1111-4111-8111-111111111111";
const rpc = vi.fn();
const admin = { rpc: (...a: unknown[]) => rpc(...a) } as never;

const item = { obraId: OBRA, subscriptionId: "mp_1", descontoCentavos: 2598, alvoCentavos: null };
const assinatura = (status: AssinaturaMp["status"], cobradas: number): AssinaturaMp => ({
  id: "mp_1",
  status,
  summarized: { charged_quantity: cobradas },
  auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 103.92, currency_id: "BRL" },
});

function deps(a: AssinaturaMp) {
  return {
    consultarAssinatura: vi.fn(async () => a),
    atualizarValorAssinatura: vi.fn(async () => ({}) as AssinaturaMp),
  };
}

beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (nome: string) => {
    if (nome === "fn_afiliado_descontos_a_reverter") return { data: [item], error: null };
    if (nome === "fn_afiliado_desconto_reversao_alvo") return { data: 12990, error: null };
    return { data: null, error: null };
  });
});

describe("executarReversaoDescontos", () => {
  it("reverte quando o provedor confirma a 1ª cobrança", async () => {
    const d = deps(assinatura("authorized", 1));
    const r = await executarReversaoDescontos(admin, d);
    expect(r).toEqual({ revertidos: 1, aguardando: 0, falhas: 0 });
    expect(d.atualizarValorAssinatura).toHaveBeenCalledWith("mp_1", 12990);
  });

  it("espera enquanto a 1ª cobrança não aconteceu (primeira cobrança adiada)", async () => {
    const d = deps(assinatura("authorized", 0));
    const r = await executarReversaoDescontos(admin, d);
    expect(r).toEqual({ revertidos: 0, aguardando: 1, falhas: 0 });
    expect(d.atualizarValorAssinatura).not.toHaveBeenCalled();
  });

  it("uma falha não impede o restante e é contada", async () => {
    const d = deps(assinatura("authorized", 1));
    d.atualizarValorAssinatura.mockRejectedValue(new Error("429"));
    const r = await executarReversaoDescontos(admin, d);
    expect(r).toEqual({ revertidos: 0, aguardando: 0, falhas: 1 });
  });

  it("migration ainda não aplicada = nada a fazer", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "x" } });
    expect(await executarReversaoDescontos(admin, deps(assinatura("authorized", 1)))).toEqual({
      revertidos: 0,
      aguardando: 0,
      falhas: 0,
    });
  });
});
