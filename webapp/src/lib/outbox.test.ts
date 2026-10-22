import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const consultarAssinatura = vi.fn();
const atualizarValorAssinatura = vi.fn();

vi.mock("@/config/pricing", () => ({
  OBRA_ATIVA: { precoCentavos: 12990 },
  EMAIL_ADICIONAL: { precoCentavos: 2990 },
}));
vi.mock("@/lib/log", () => ({ logSeguro: vi.fn(), sanitizarErro: () => "erro" }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: (...a: unknown[]) => rpc(...a) }) }));
vi.mock("@/lib/mercadopago", async () => {
  const real = await vi.importActual<typeof import("@/lib/mercadopago")>("@/lib/mercadopago");
  return {
    ...real,
    consultarAssinatura: (...a: unknown[]) => consultarAssinatura(...a),
    atualizarValorAssinatura: (...a: unknown[]) => atualizarValorAssinatura(...a),
  };
});

import { MercadoPagoError } from "@/lib/mercadopago";
import { processarOutbox } from "./outbox";

const claim = (operacao: "add" | "subtract") => ({
  data: { status: "processando", operacao, subscriptionId: "mp_1", obraId: "o1", assinaturaId: "a1" },
  error: null,
});
const viva = (reais: number, cobradas = 1) => ({
  status: "authorized",
  auto_recurring: { transaction_amount: reais },
  summarized: { charged_quantity: cobradas },
});
const chamou = (nome: string) => rpc.mock.calls.find((c) => c[0] === nome)?.[1];

beforeEach(() => {
  rpc.mockReset();
  consultarAssinatura.mockReset();
  atualizarValorAssinatura.mockReset();
});

describe("processarOutbox (valor da assinatura no Mercado Pago)", () => {
  it("add soma o e-mail adicional ao valor atual e confirma", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "fn_claim_outbox"
        ? claim("add")
        : { data: { enviarEmail: true, email: "x@example.com" }, error: null },
    );
    consultarAssinatura.mockResolvedValue(viva(129.9));
    atualizarValorAssinatura.mockResolvedValue({});
    const r = await processarOutbox("out-1");
    expect(atualizarValorAssinatura).toHaveBeenCalledWith("mp_1", 15980);
    expect(chamou("fn_confirmar_outbox")).toEqual({
      p_outbox: "out-1",
      p_usage_id: "mp:out-1",
      p_installment: 2,
    });
    expect(r).toEqual({ ok: true, enviarEmail: true, email: "x@example.com", obraId: "o1" });
  });

  it("subtract tira o adicional, sem passar do valor da obra", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "fn_claim_outbox" ? claim("subtract") : { data: {}, error: null },
    );
    consultarAssinatura.mockResolvedValue(viva(158.8));
    atualizarValorAssinatura.mockResolvedValue({});
    await processarOutbox("out-2");
    expect(atualizarValorAssinatura).toHaveBeenCalledWith("mp_1", 12990);

    atualizarValorAssinatura.mockClear();
    consultarAssinatura.mockResolvedValue(viva(129.9));
    await processarOutbox("out-3");
    expect(atualizarValorAssinatura).not.toHaveBeenCalled();
    expect(chamou("fn_confirmar_outbox")).toBeDefined();
  });

  it("com desconto de afiliado em vigor o piso é a obra já descontada", async () => {
    rpc.mockImplementation(async (nome: string) => {
      if (nome === "fn_claim_outbox") return claim("subtract");
      if (nome === "fn_afiliado_desconto_assinatura") return { data: 2598, error: null };
      return { data: {}, error: null };
    });
    // R$ 103,92 (obra com 20% off) + R$ 29,90 do e-mail adicional
    consultarAssinatura.mockResolvedValue(viva(133.82));
    atualizarValorAssinatura.mockResolvedValue({});
    await processarOutbox("out-6");
    expect(chamou("fn_afiliado_desconto_assinatura")).toEqual({
      p_subscription_id: "mp_1",
      p_preco_centavos: 12990,
    });
    // sem o desconto no piso, subiria para o preço cheio (R$ 129,90)
    expect(atualizarValorAssinatura).toHaveBeenCalledWith("mp_1", 10392);

    atualizarValorAssinatura.mockClear();
    consultarAssinatura.mockResolvedValue(viva(103.92));
    await processarOutbox("out-7");
    expect(atualizarValorAssinatura).not.toHaveBeenCalled();
  });

  it("erro ao consultar o desconto deixa o item incerto, sem mexer no valor", async () => {
    rpc.mockImplementation(async (nome: string) => {
      if (nome === "fn_claim_outbox") return claim("add");
      if (nome === "fn_afiliado_desconto_assinatura") return { data: null, error: { code: "XX000", message: "x" } };
      return { data: null, error: null };
    });
    consultarAssinatura.mockResolvedValue(viva(129.9));
    const r = await processarOutbox("out-8");
    expect(r.ok).toBe(false);
    expect(atualizarValorAssinatura).not.toHaveBeenCalled();
    expect(chamou("fn_falhar_outbox")).toMatchObject({ p_incerto: true });
  });

  it("assinatura que não está autorizada falha sem alterar o valor", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "fn_claim_outbox" ? claim("add") : { data: null, error: null },
    );
    consultarAssinatura.mockResolvedValue({ ...viva(129.9), status: "cancelled" });
    const r = await processarOutbox("out-4");
    expect(r).toEqual({ ok: false, erro: "COBRANCA_RECUSADA" });
    expect(atualizarValorAssinatura).not.toHaveBeenCalled();
    expect(chamou("fn_falhar_outbox")).toMatchObject({ p_incerto: false, p_erro: "ASSINATURA_INATIVA" });
  });

  it("compensação em assinatura já cancelada pelo app só confirma", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "fn_claim_outbox" ? claim("subtract") : { data: {}, error: null },
    );
    consultarAssinatura.mockResolvedValue({ ...viva(158.8), status: "cancelled" });
    const r = await processarOutbox("out-5");
    expect(r.ok).toBe(true);
    expect(atualizarValorAssinatura).not.toHaveBeenCalled();
  });

  it("erro 5xx do provedor deixa o item incerto; 4xx falha de vez; 429 reagenda", async () => {
    rpc.mockImplementation(async (nome: string) =>
      nome === "fn_claim_outbox" ? claim("add") : { data: null, error: null },
    );
    consultarAssinatura.mockResolvedValue(viva(129.9));
    atualizarValorAssinatura.mockRejectedValueOnce(new MercadoPagoError("x", 503));
    expect(await processarOutbox("a")).toEqual({ ok: false, erro: "COBRANCA_INCERTA" });
    expect(chamou("fn_falhar_outbox")).toMatchObject({ p_incerto: true });

    rpc.mockClear();
    atualizarValorAssinatura.mockRejectedValueOnce(new MercadoPagoError("x", 400));
    expect(await processarOutbox("b")).toEqual({ ok: false, erro: "COBRANCA_RECUSADA" });
    expect(chamou("fn_falhar_outbox")).toMatchObject({ p_incerto: false });

    rpc.mockClear();
    atualizarValorAssinatura.mockRejectedValueOnce(new MercadoPagoError("x", 429));
    expect(await processarOutbox("c")).toEqual({ ok: false, erro: "RATE_LIMITED" });
    expect(chamou("fn_reagendar_outbox")).toBeDefined();
  });

  it("item já confirmado ou em andamento não toca no provedor", async () => {
    rpc.mockResolvedValue({ data: { status: "confirmado" }, error: null });
    expect(await processarOutbox("d")).toEqual({ ok: true });
    rpc.mockResolvedValue({ data: { status: "processando", repetirProvedor: false }, error: null });
    expect(await processarOutbox("e")).toEqual({ ok: false, erro: "COBRANCA_INCERTA" });
    expect(consultarAssinatura).not.toHaveBeenCalled();
  });
});
