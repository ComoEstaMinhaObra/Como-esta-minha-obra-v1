import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssinaturaMp } from "@/lib/mercadopago";
import {
  SEM_DESCONTO,
  descontoDaAssinatura,
  descontoDaObra,
  liberarDescontoDaObra,
  reverterDesconto,
} from "./desconto";

vi.mock("@/lib/log", () => ({ logSeguro: vi.fn(), sanitizarErro: () => "erro" }));

const rpc = vi.fn();
const admin = { rpc: (...a: unknown[]) => rpc(...a) } as never;
const OBRA = "11111111-1111-4111-8111-111111111111";

beforeEach(() => rpc.mockReset());

describe("descontoDaObra", () => {
  it("repassa preço e flag de reserva e devolve o desconto", async () => {
    rpc.mockResolvedValue({
      data: { descontoCentavos: 2598, descontoBps: 2000, duracao: "primeira_fatura" },
      error: null,
    });
    const r = await descontoDaObra(admin, "u1", OBRA, 12990, true);
    expect(rpc).toHaveBeenCalledWith("fn_afiliado_desconto_obra", {
      p_user: "u1",
      p_obra: OBRA,
      p_preco_centavos: 12990,
      p_reservar: true,
    });
    expect(r).toEqual({ descontoCentavos: 2598, descontoBps: 2000, duracao: "primeira_fatura" });
  });

  it("sem desconto, ou resposta fora do esperado, nunca vira preço", async () => {
    for (const data of [{ descontoCentavos: 0 }, null, { descontoCentavos: -5 }, { descontoCentavos: 12990 }, { descontoCentavos: 1.5 }]) {
      rpc.mockResolvedValue({ data, error: null });
      expect(await descontoDaObra(admin, "u1", OBRA, 12990, false)).toEqual(SEM_DESCONTO);
    }
  });

  it("função ainda não publicada no banco = sem desconto", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "missing" } });
    expect(await descontoDaObra(admin, "u1", OBRA, 12990, true)).toEqual(SEM_DESCONTO);
  });

  it("outro erro do banco sobe (cobrar o preço errado é pior que falhar)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(descontoDaObra(admin, "u1", OBRA, 12990, true)).rejects.toThrow();
  });
});

describe("liberarDescontoDaObra", () => {
  it("engole falhas: a reserva solta é inofensiva", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(liberarDescontoDaObra(admin, "u1", OBRA)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith("fn_afiliado_desconto_liberar", { p_user: "u1", p_obra: OBRA });
  });
});

describe("descontoDaAssinatura", () => {
  it("devolve o desconto em vigor ou 0", async () => {
    rpc.mockResolvedValue({ data: 2598, error: null });
    expect(await descontoDaAssinatura(admin, "mp_1", 12990)).toBe(2598);
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await descontoDaAssinatura(admin, "mp_1", 12990)).toBe(0);
    rpc.mockResolvedValue({ data: 99999, error: null });
    expect(await descontoDaAssinatura(admin, "mp_1", 12990)).toBe(0);
  });

  it("função ausente = 0; outro erro sobe", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42883", message: "x" } });
    expect(await descontoDaAssinatura(admin, "mp_1", 12990)).toBe(0);
    rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "x" } });
    await expect(descontoDaAssinatura(admin, "mp_1", 12990)).rejects.toThrow();
  });
});

function assinatura(status: AssinaturaMp["status"], reais: number): AssinaturaMp {
  return {
    id: "mp_1",
    status,
    auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: reais, currency_id: "BRL" },
  };
}

describe("reverterDesconto", () => {
  it("grava o alvo (atual + desconto), atualiza o provedor e marca como revertido", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "fn_afiliado_desconto_reversao_alvo" ? { data: 12990, error: null } : { data: null, error: null },
    );
    const atualizar = vi.fn(async () => ({}));
    const ok = await reverterDesconto(
      admin,
      { obraId: OBRA, assinatura: assinatura("authorized", 103.92), descontoCentavos: 2598 },
      atualizar,
    );
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("fn_afiliado_desconto_reversao_alvo", {
      p_obra: OBRA,
      p_alvo_centavos: 12990,
    });
    expect(atualizar).toHaveBeenCalledWith("mp_1", 12990);
    expect(rpc).toHaveBeenCalledWith("fn_afiliado_desconto_revertido", { p_obra: OBRA });
  });

  it("usa o alvo já gravado, sem recalcular", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const atualizar = vi.fn(async () => ({}));
    await reverterDesconto(
      admin,
      { obraId: OBRA, assinatura: assinatura("authorized", 129.9), descontoCentavos: 2598, alvoCentavos: 12990 },
      atualizar,
    );
    expect(rpc).not.toHaveBeenCalledWith("fn_afiliado_desconto_reversao_alvo", expect.anything());
    expect(atualizar).toHaveBeenCalledWith("mp_1", 12990);
  });

  it("assinatura cancelada só é dada como encerrada; pendente/pausada espera", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const atualizar = vi.fn(async () => ({}));
    expect(
      await reverterDesconto(admin, { obraId: OBRA, assinatura: assinatura("cancelled", 103.92), descontoCentavos: 2598 }, atualizar),
    ).toBe(true);
    expect(atualizar).not.toHaveBeenCalled();
    rpc.mockClear();
    expect(
      await reverterDesconto(admin, { obraId: OBRA, assinatura: assinatura("paused", 103.92), descontoCentavos: 2598 }, atualizar),
    ).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("falha ao marcar tenta 3 vezes e sobe o erro", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(
      reverterDesconto(
        admin,
        { obraId: OBRA, assinatura: assinatura("cancelled", 103.92), descontoCentavos: 2598 },
        vi.fn(),
      ),
    ).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(3);
  });
});
