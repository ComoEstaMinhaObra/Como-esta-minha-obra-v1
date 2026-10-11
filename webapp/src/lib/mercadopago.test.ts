import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  atualizarValorAssinatura,
  cancelarAssinatura,
  cartaoRecusado,
  centavosParaReais,
  criarAssinatura,
  MercadoPagoError,
  reaisParaCentavos,
} from "@/lib/mercadopago";
import {
  montarManifestMp,
  validarAssinaturaMercadoPago,
} from "@/lib/mercadopago-signature";

const SEGREDO = "segredo-de-teste";

function assinar(dataId: string | null, requestId: string | null, ts: string) {
  const v1 = createHmac("sha256", SEGREDO)
    .update(montarManifestMp(dataId, requestId, ts))
    .digest("hex");
  return `ts=${ts},v1=${v1}`;
}

describe("conversão de valores", () => {
  it("converte centavos em reais sem erro de ponto flutuante", () => {
    expect(centavosParaReais(12990)).toBe(129.9);
    expect(centavosParaReais(2990)).toBe(29.9);
    expect(centavosParaReais(12990 + 2 * 2990)).toBe(189.7);
    expect(centavosParaReais(1)).toBe(0.01);
  });

  it("converte reais em centavos de volta", () => {
    expect(reaisParaCentavos(129.9)).toBe(12990);
    expect(reaisParaCentavos(189.7)).toBe(18970);
    expect(reaisParaCentavos(0.01)).toBe(1);
  });

  it("rejeita valores inválidos", () => {
    expect(() => centavosParaReais(0)).toThrow("VALOR_INVALIDO");
    expect(() => centavosParaReais(-5)).toThrow("VALOR_INVALIDO");
    expect(() => centavosParaReais(129.9)).toThrow("VALOR_INVALIDO");
    expect(() => reaisParaCentavos(Number.NaN)).toThrow("VALOR_INVALIDO");
  });
});

describe("validarAssinaturaMercadoPago", () => {
  const ts = "1742505638683";

  it("aceita assinatura correta e o data.id alfanumérico em minúsculas", () => {
    const x = assinar("abc123def", "req-1", ts);
    expect(
      validarAssinaturaMercadoPago({
        xSignature: x,
        xRequestId: "req-1",
        dataId: "ABC123DEF",
        secret: SEGREDO,
      }),
    ).toBe(true);
  });

  it("aceita data.id numérico", () => {
    const x = assinar("123456", "req-2", ts);
    expect(
      validarAssinaturaMercadoPago({
        xSignature: x,
        xRequestId: "req-2",
        dataId: "123456",
        secret: SEGREDO,
      }),
    ).toBe(true);
  });

  it("omite do manifest as partes ausentes", () => {
    expect(montarManifestMp(null, null, ts)).toBe(`ts:${ts};`);
    expect(montarManifestMp("1", null, ts)).toBe(`id:1;ts:${ts};`);
  });

  it("rejeita segredo errado, id adulterado e request-id adulterado", () => {
    const x = assinar("123456", "req-3", ts);
    const base = { xSignature: x, xRequestId: "req-3", dataId: "123456" };
    expect(validarAssinaturaMercadoPago({ ...base, secret: "outro" })).toBe(false);
    expect(
      validarAssinaturaMercadoPago({ ...base, dataId: "999", secret: SEGREDO }),
    ).toBe(false);
    expect(
      validarAssinaturaMercadoPago({ ...base, xRequestId: "x", secret: SEGREDO }),
    ).toBe(false);
  });

  it("rejeita cabeçalho ausente, malformado ou sem v1", () => {
    const base = { xRequestId: "r", dataId: "1", secret: SEGREDO };
    expect(validarAssinaturaMercadoPago({ ...base, xSignature: null })).toBe(false);
    expect(validarAssinaturaMercadoPago({ ...base, xSignature: "lixo" })).toBe(false);
    expect(validarAssinaturaMercadoPago({ ...base, xSignature: `ts=${ts}` })).toBe(false);
    expect(
      validarAssinaturaMercadoPago({ ...base, xSignature: `ts=${ts},v1=abc` }),
    ).toBe(false);
  });
});

describe("client /preapproval", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token-de-teste");
    vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SEGREDO);
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function respostaOk(corpo: unknown) {
    return { ok: true, status: 200, json: async () => corpo };
  }

  it("cria assinatura autorizada com valor em reais e a obra como external_reference", async () => {
    fetchMock.mockResolvedValue(respostaOk({ id: "pre_1", status: "authorized" }));
    await criarAssinatura({
      obraId: "11111111-1111-4111-8111-111111111111",
      payerEmail: "comprador@testuser.com",
      valorCentavos: 12990,
      motivo: "Como Está Minha Obra — obra ativa",
      backUrl: "https://staging.exemplo.com/cobranca",
      cardTokenId: "tok_123",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/preapproval");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer APP_USR-token-de-teste");
    expect(init.headers["X-Idempotency-Key"]).toBeTruthy();
    const corpo = JSON.parse(init.body);
    expect(corpo.status).toBe("authorized");
    expect(corpo.card_token_id).toBe("tok_123");
    expect(corpo.external_reference).toBe("11111111-1111-4111-8111-111111111111");
    expect(corpo.auto_recurring.transaction_amount).toBe(129.9);
    expect(corpo.auto_recurring.currency_id).toBe("BRL");
    expect(corpo.auto_recurring.free_trial).toBeUndefined();
  });

  it("adia a primeira cobrança quando há dias de espera e fica pendente sem cartão", async () => {
    fetchMock.mockResolvedValue(respostaOk({ id: "pre_2", status: "pending" }));
    await criarAssinatura({
      obraId: "22222222-2222-4222-8222-222222222222",
      payerEmail: "comprador@testuser.com",
      valorCentavos: 12990,
      motivo: "obra",
      backUrl: "https://staging.exemplo.com/cobranca",
      primeiraCobrancaEmDias: 9,
    });
    const corpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(corpo.status).toBe("pending");
    expect(corpo.card_token_id).toBeUndefined();
    expect(corpo.auto_recurring.free_trial).toEqual({
      frequency: 9,
      frequency_type: "days",
    });
  });

  it("cancela com PUT status cancelled", async () => {
    fetchMock.mockResolvedValue(respostaOk({ id: "pre_3", status: "cancelled" }));
    await cancelarAssinatura("pre_3");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mercadopago.com/preapproval/pre_3");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({ status: "cancelled" });
  });

  it("altera o valor em reais e usa chave de idempotência determinística", async () => {
    fetchMock.mockResolvedValue(respostaOk({ id: "pre_4", status: "authorized" }));
    await atualizarValorAssinatura("pre_4", 15980);
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).auto_recurring.transaction_amount).toBe(159.8);
    expect(init.headers["X-Idempotency-Key"]).toBe("valor-pre_4-15980");
  });

  it("converte resposta de erro em MercadoPagoError sem vazar o corpo", async () => {
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: "Both payer and collector must be real or test users", status: 400 }),
    });
    await expect(cancelarAssinatura("pre_5")).rejects.toMatchObject({
      name: "MercadoPagoError",
      status: 400,
    });
    expect(erro).toHaveBeenCalledWith("[mercadopago]", {
      status: 400,
      path: "/preapproval/pre_5",
    });
    erro.mockRestore();
    expect(new MercadoPagoError("x", 500)).toBeInstanceOf(Error);
  });

  it("cancelar uma assinatura já cancelada vale como sucesso", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: "You can not modify a cancelled preapproval.", status: 400 }),
      })
      .mockResolvedValueOnce(respostaOk({ id: "pre_6", status: "cancelled" }));
    const r = await cancelarAssinatura("pre_6");
    expect(r.status).toBe("cancelled");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.mercadopago.com/preapproval/pre_6");
    expect(fetchMock.mock.calls[1][1].method).toBe("GET");
  });

  it("cancelar com 400 e assinatura ainda viva propaga o erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ message: "outro erro" }) })
      .mockResolvedValueOnce(respostaOk({ id: "pre_7", status: "authorized" }));
    await expect(cancelarAssinatura("pre_7")).rejects.toBeInstanceOf(MercadoPagoError);
  });
});

describe("cartaoRecusado", () => {
  it("reconhece a recusa na contratação e na troca de cartão", () => {
    expect(
      cartaoRecusado(new MercadoPagoError("CC_VAL_433 Credit card validation has failed", 400, "rejected")),
    ).toBe(true);
    expect(cartaoRecusado(new MercadoPagoError("Unknown error", 402, "Subscription payment required"))).toBe(true);
  });

  it("não confunde outros erros com recusa de cartão", () => {
    expect(cartaoRecusado(new MercadoPagoError("Both payer and collector must be real or test users", 400))).toBe(false);
    expect(cartaoRecusado(new MercadoPagoError("erro", 500))).toBe(false);
    expect(cartaoRecusado(new Error("x"))).toBe(false);
  });
});
