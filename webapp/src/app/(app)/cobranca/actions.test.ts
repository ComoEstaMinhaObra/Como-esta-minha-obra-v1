import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const cancelarAssinatura = vi.fn();
const criarAssinatura = vi.fn();
const registrarCobrancaAssinatura = vi.fn();

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/config/env", () => ({
  publicEnv: { NEXT_PUBLIC_APP_URL: "http://localhost:3000" },
}));
vi.mock("@/config/pricing", () => ({ OBRA_ATIVA: { precoCentavos: 12990 } }));
vi.mock("@/lib/log", () => ({ logSeguro: vi.fn(), sanitizarErro: () => "erro" }));
vi.mock("@/lib/mercadopago", () => ({
  cancelarAssinatura: (...a: unknown[]) => cancelarAssinatura(...a),
  criarAssinatura: (...a: unknown[]) => criarAssinatura(...a),
  cartaoRecusado: (e: unknown) => (e as { recusado?: boolean })?.recusado === true,
}));
vi.mock("@/lib/cobranca/mercadopago-webhook", () => ({
  registrarCobrancaAssinatura: (...a: unknown[]) => registrarCobrancaAssinatura(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ admin: true }) }));

type Tabelas = Record<string, unknown>;
let tabelas: Tabelas = {};

function consulta(tabela: string) {
  const resultado = { data: tabelas[tabela] ?? null };
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "neq"]) q[m] = () => q;
  q.maybeSingle = async () => resultado;
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1", email: "u@example.com" } } }) },
    rpc: (...a: unknown[]) => rpc(...a),
    from: (t: string) => consulta(t),
  }),
}));

import { contratarObra, regularizarPagamento } from "./actions";

const chamadas = () => rpc.mock.calls.map((c) => c[0]);
const OBRA = "11111111-1111-4111-8111-111111111111";
const assinaturaNova = { id: "mp_novo", status: "authorized", external_reference: OBRA };

beforeEach(() => {
  rpc.mockReset();
  cancelarAssinatura.mockReset();
  criarAssinatura.mockReset();
  registrarCobrancaAssinatura.mockReset();
  tabelas = {
    obras: { id: OBRA, owner_id: "u1", arquivada_em: null },
    cobrancas_obra: null,
    assinaturas: { status: "trial" },
  };
  rpc.mockImplementation(async (nome: string) => {
    if (nome === "fn_vaga_paga_disponivel") return { data: { disponivel: false }, error: null };
    return { data: null, error: null };
  });
});

describe("contratarObra", () => {
  it("sem o cartão tokenizado não chama o provedor", async () => {
    const r = await contratarObra(OBRA);
    expect(r).toEqual({ ok: false, erro: "CARTAO_OBRIGATORIO" });
    expect(criarAssinatura).not.toHaveBeenCalled();
  });

  it("cria a assinatura com o cartão e registra a cobrança na hora", async () => {
    criarAssinatura.mockResolvedValue(assinaturaNova);
    registrarCobrancaAssinatura.mockResolvedValue({ ok: true, criada: true });
    const r = await contratarObra(OBRA, "tok_1");
    expect(r).toEqual({ ok: true, obraId: OBRA, confirmando: false });
    expect(criarAssinatura).toHaveBeenCalledWith(
      expect.objectContaining({
        obraId: OBRA,
        payerEmail: "u@example.com",
        valorCentavos: 12990,
        cardTokenId: "tok_1",
        primeiraCobrancaEmDias: undefined,
      }),
    );
    expect(registrarCobrancaAssinatura).toHaveBeenCalledWith({ admin: true }, assinaturaNova);
  });

  it("período pago aproveitável adia a primeira cobrança em dias (regra Q1)", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "fn_vaga_paga_disponivel"
        ? { data: { disponivel: true, dias: 9 }, error: null }
        : { data: null, error: null },
    );
    criarAssinatura.mockResolvedValue(assinaturaNova);
    registrarCobrancaAssinatura.mockResolvedValue({ ok: true, criada: true });
    await contratarObra(OBRA, "tok_1");
    expect(criarAssinatura).toHaveBeenCalledWith(
      expect.objectContaining({ primeiraCobrancaEmDias: 9 }),
    );
  });

  it("cartão recusado não cria cobrança", async () => {
    criarAssinatura.mockRejectedValue({ recusado: true });
    const r = await contratarObra(OBRA, "tok_1");
    expect(r).toEqual({ ok: false, erro: "CARTAO_RECUSADO" });
    expect(registrarCobrancaAssinatura).not.toHaveBeenCalled();
  });

  it("falha do provedor devolve erro genérico", async () => {
    criarAssinatura.mockRejectedValue(new Error("fora do ar"));
    const r = await contratarObra(OBRA, "tok_1");
    expect(r).toEqual({ ok: false, erro: "FALHA_CHECKOUT" });
  });

  it("falha ao registrar localmente mantém o sucesso e deixa o webhook confirmar", async () => {
    criarAssinatura.mockResolvedValue(assinaturaNova);
    registrarCobrancaAssinatura.mockRejectedValue(new Error("banco fora"));
    const r = await contratarObra(OBRA, "tok_1");
    expect(r).toEqual({ ok: true, obraId: OBRA, confirmando: true });
  });

  it("obra de outro dono, arquivada ou já contratada não chega ao provedor", async () => {
    tabelas.obras = { id: OBRA, owner_id: "outro", arquivada_em: null };
    expect(await contratarObra(OBRA, "tok_1")).toEqual({ ok: false, erro: "SEM_PERMISSAO" });
    tabelas.obras = { id: OBRA, owner_id: "u1", arquivada_em: "2026-01-01" };
    expect(await contratarObra(OBRA, "tok_1")).toEqual({ ok: false, erro: "OBRA_ARQUIVADA" });
    tabelas.obras = { id: OBRA, owner_id: "u1", arquivada_em: null };
    tabelas.cobrancas_obra = { status: "ativa", acesso_ate: null };
    expect(await contratarObra(OBRA, "tok_1")).toEqual({ ok: false, erro: "JA_CONTRATADA" });
    expect(criarAssinatura).not.toHaveBeenCalled();
  });
});

describe("regularizarPagamento", () => {
  it("sem o cartão tokenizado nada é gravado", async () => {
    const r = await regularizarPagamento(OBRA);
    expect(r).toEqual({ ok: false, erro: "CARTAO_OBRIGATORIO" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("obra sem pagamento pendente: não chama o provedor", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "COBRANCA_NAO_REGULARIZAVEL" } });
    const r = await regularizarPagamento(OBRA, "tok_1");
    expect(r).toEqual({ ok: false, erro: "COBRANCA_NAO_REGULARIZAVEL" });
    expect(criarAssinatura).not.toHaveBeenCalled();
    expect(cancelarAssinatura).not.toHaveBeenCalled();
  });

  it("cartão novo recusado desfaz a intenção e não encerra a assinatura com falha", async () => {
    rpc.mockResolvedValueOnce({ data: { subscriptionId: "mp_velho" }, error: null });
    criarAssinatura.mockRejectedValue({ recusado: true });
    const r = await regularizarPagamento(OBRA, "tok_1");
    expect(r).toEqual({ ok: false, erro: "CARTAO_RECUSADO" });
    expect(chamadas()).toContain("fn_cobranca_desfazer_regularizacao");
    expect(cancelarAssinatura).not.toHaveBeenCalled();
  });

  it("falha ao encerrar a antiga desfaz a nova e a intenção", async () => {
    rpc.mockResolvedValueOnce({ data: { subscriptionId: "mp_velho" }, error: null });
    criarAssinatura.mockResolvedValue(assinaturaNova);
    cancelarAssinatura.mockRejectedValueOnce(new Error("falhou")).mockResolvedValue({});
    const r = await regularizarPagamento(OBRA, "tok_1");
    expect(r).toEqual({ ok: false, erro: "FALHA_PROVEDOR" });
    expect(cancelarAssinatura).toHaveBeenNthCalledWith(1, "mp_velho");
    expect(cancelarAssinatura).toHaveBeenNthCalledWith(2, "mp_novo");
    expect(chamadas()).toContain("fn_cobranca_desfazer_regularizacao");
    expect(chamadas()).not.toContain("fn_cobranca_concluir_regularizacao");
  });

  it("fluxo completo: cria a nova, encerra a antiga, conclui e registra", async () => {
    rpc.mockResolvedValueOnce({ data: { subscriptionId: "mp_velho" }, error: null });
    criarAssinatura.mockResolvedValue(assinaturaNova);
    cancelarAssinatura.mockResolvedValue({});
    registrarCobrancaAssinatura.mockResolvedValue({ ok: true, criada: true });
    const r = await regularizarPagamento(OBRA, "tok_1");
    expect(r).toEqual({ ok: true, obraId: OBRA, confirmando: false });
    const ordem = chamadas();
    expect(ordem.indexOf("fn_cobranca_solicitar_regularizacao")).toBeLessThan(
      ordem.indexOf("fn_cobranca_concluir_regularizacao"),
    );
    expect(cancelarAssinatura).toHaveBeenCalledWith("mp_velho");
    expect(registrarCobrancaAssinatura).toHaveBeenCalledWith({ admin: true }, assinaturaNova);
  });

  it("falha ao concluir localmente tenta de novo e, se persistir, avisa sem registrar", async () => {
    rpc.mockImplementation(async (nome: string) => {
      if (nome === "fn_cobranca_solicitar_regularizacao") {
        return { data: { subscriptionId: "mp_velho" }, error: null };
      }
      if (nome === "fn_cobranca_concluir_regularizacao") {
        return { data: null, error: { message: "boom" } };
      }
      return { data: null, error: null };
    });
    criarAssinatura.mockResolvedValue(assinaturaNova);
    cancelarAssinatura.mockResolvedValue({});
    const r = await regularizarPagamento(OBRA, "tok_1");
    expect(r).toEqual({ ok: false, erro: "FALHA_CONCLUIR" });
    expect(chamadas().filter((n) => n === "fn_cobranca_concluir_regularizacao")).toHaveLength(3);
    expect(registrarCobrancaAssinatura).not.toHaveBeenCalled();
  });
});
