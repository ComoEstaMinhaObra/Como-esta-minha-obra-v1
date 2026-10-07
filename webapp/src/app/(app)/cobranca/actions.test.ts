import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const cancelarAssinatura = vi.fn();

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/config/env", () => ({
  getCobrancaEnv: () => ({}),
  publicEnv: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
}));
vi.mock("@/lib/log", () => ({ logSeguro: vi.fn(), sanitizarErro: () => "erro" }));
vi.mock("@/lib/abacatepay", () => ({
  AbacatePayError: class extends Error {},
  cancelarAssinatura: (...a: unknown[]) => cancelarAssinatura(...a),
  criarAssinatura: vi.fn(),
  criarCliente: vi.fn(),
  garantirProdutoObraComTrial: vi.fn(),
  RETRY_POLICY_OBRA: { maxRetry: 7, retryEvery: 2 },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "u@example.com" } } }) },
    rpc: (...a: unknown[]) => rpc(...a),
  }),
}));

import { regularizarPagamento } from "./actions";

const chamadas = () => rpc.mock.calls.map((c) => c[0]);

describe("regularizarPagamento", () => {
  beforeEach(() => {
    rpc.mockReset();
    cancelarAssinatura.mockReset();
  });

  it("obra sem pagamento pendente: não chama o provedor", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "COBRANCA_NAO_REGULARIZAVEL" } });
    const r = await regularizarPagamento("obra-1");
    expect(r).toEqual({ ok: false, erro: "COBRANCA_NAO_REGULARIZAVEL" });
    expect(cancelarAssinatura).not.toHaveBeenCalled();
  });

  it("grava a intenção antes de cancelar no provedor", async () => {
    rpc.mockResolvedValueOnce({ data: { subscriptionId: "subs_1" }, error: null });
    cancelarAssinatura.mockRejectedValueOnce(new Error("falhou"));
    rpc.mockResolvedValue({ data: null, error: null });
    await regularizarPagamento("obra-1");
    expect(chamadas()[0]).toBe("fn_cobranca_solicitar_regularizacao");
    expect(cancelarAssinatura).toHaveBeenCalledWith("subs_1");
  });

  it("falha do provedor desfaz a intenção e mantém a obra como estava", async () => {
    rpc.mockResolvedValueOnce({ data: { subscriptionId: "subs_1" }, error: null });
    cancelarAssinatura.mockRejectedValueOnce(new Error("falhou"));
    rpc.mockResolvedValue({ data: null, error: null });
    const r = await regularizarPagamento("obra-1");
    expect(r).toEqual({ ok: false, erro: "FALHA_PROVEDOR" });
    expect(chamadas()).toContain("fn_cobranca_desfazer_regularizacao");
    expect(chamadas()).not.toContain("fn_cobranca_concluir_regularizacao");
  });

  it("falha ao concluir localmente avisa para usar Reativar e não abre checkout", async () => {
    rpc.mockResolvedValueOnce({ data: { subscriptionId: "subs_1" }, error: null });
    cancelarAssinatura.mockResolvedValueOnce({});
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const r = await regularizarPagamento("obra-1");
    expect(r).toEqual({ ok: false, erro: "FALHA_CONCLUIR" });
  });
});
