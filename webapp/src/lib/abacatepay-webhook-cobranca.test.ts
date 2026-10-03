import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  processarEventoAssinatura,
  type WebhookPayload,
} from "@/lib/abacatepay-webhook";

const OBRA = "11111111-1111-4111-8111-111111111111";

const consultarAssinatura = vi.fn();

vi.mock("@/lib/abacatepay", () => ({
  consultarAssinatura: (...a: unknown[]) => consultarAssinatura(...a),
  limiteDoPlano: () => 1,
  planoPorProdutoId: () => null,
}));
vi.mock("@/lib/outbox", () => ({ processarOutbox: vi.fn() }));

interface Cenario {
  cobranca?: { id: string; obra_id: string; status: string } | null;
  obra?: { id: string } | null;
  rpc?: Record<string, { data?: unknown; error?: { message: string } | null }>;
}

function admin(c: Cenario = {}) {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const logUpdates: Array<Record<string, unknown>> = [];

  const tabela = (row: unknown) => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: row ?? null }) }),
    }),
  });

  return {
    rpcCalls,
    logUpdates,
    rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn === "fn_claim_webhook_evento") {
        return { data: { logId: "log-1", duplicado: false }, error: null };
      }
      const r = c.rpc?.[fn];
      return { data: r?.data ?? null, error: r?.error ?? null };
    }),
    from: vi.fn((t: string) => {
      if (t === "cobrancas_obra") return tabela(c.cobranca);
      if (t === "obras") return tabela(c.obra);
      if (t === "webhooks_log") {
        return {
          update: (v: Record<string, unknown>) => {
            logUpdates.push(v);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      return tabela(null);
    }),
  };
}

function payload(evento: string, extras: Partial<WebhookPayload["data"]> = {}): WebhookPayload {
  return {
    id: `log_${evento}`,
    event: evento,
    data: {
      subscription: { id: "subs_1", status: "ACTIVE", externalId: null },
      checkout: { externalId: OBRA, items: [{ id: "prod_obra", quantity: 1 }] },
      payment: { externalId: OBRA },
      ...extras,
    },
  };
}

function chamada(a: ReturnType<typeof admin>, fn: string) {
  return a.rpcCalls.find((c) => c.fn === fn);
}

beforeEach(() => {
  consultarAssinatura.mockReset();
});

describe("webhook da cobrança por obra", () => {
  it("subscription.completed registra a cobrança da obra (checkout.externalId)", async () => {
    const a = admin({ obra: { id: OBRA } });
    const r = await processarEventoAssinatura(a as never, payload("subscription.completed"));

    expect(r.ok).toBe(true);
    const reg = chamada(a, "fn_cobranca_registrar");
    expect(reg?.args.p_obra).toBe(OBRA);
    expect(reg?.args.p_subscription_id).toBe("subs_1");
    expect(reg?.args.p_valor_centavos).toBe(12990);
    const inicio = new Date(reg?.args.p_periodo_inicio as string).getTime();
    const fim = new Date(reg?.args.p_periodo_fim as string).getTime();
    expect(fim - inicio).toBeGreaterThanOrEqual(28 * 86400_000);
    expect(fim - inicio).toBeLessThanOrEqual(31 * 86400_000);
    expect(reg?.args.p_primeira_cobranca_em).toBeNull();
    expect(a.logUpdates.at(-1)).toMatchObject({ processado: true, erro: null });
  });

  it("subscription.trial_started usa o fim do trial como período e primeira cobrança", async () => {
    consultarAssinatura.mockResolvedValue({
      id: "subs_1",
      checkoutId: "bill_9",
      trialEndsAt: "2026-10-15T23:59:59.999Z",
    });
    const a = admin({ obra: { id: OBRA } });
    const r = await processarEventoAssinatura(a as never, payload("subscription.trial_started"));

    expect(r.ok).toBe(true);
    const reg = chamada(a, "fn_cobranca_registrar");
    expect(reg?.args.p_periodo_fim).toBe("2026-10-15T23:59:59.999Z");
    expect(reg?.args.p_primeira_cobranca_em).toBe("2026-10-15T23:59:59.999Z");
    expect(reg?.args.p_checkout_id).toBe("bill_9");
    expect(consultarAssinatura).toHaveBeenCalledWith("subs_1");
  });

  it("trial_started sem data de fim falha para o provedor tentar de novo", async () => {
    consultarAssinatura.mockResolvedValue({ id: "subs_1", trialEndsAt: null });
    const a = admin({ obra: { id: OBRA } });
    await expect(
      processarEventoAssinatura(a as never, payload("subscription.trial_started")),
    ).rejects.toThrow("TRIAL_SEM_DATA");
    expect(a.logUpdates.at(-1)).toMatchObject({ processado: false });
  });

  it("subscription.renewed renova a cobrança já registrada", async () => {
    const a = admin({
      cobranca: { id: "c1", obra_id: OBRA, status: "inadimplente" },
      rpc: { fn_cobranca_renovar: { data: { alterada: true } } },
    });
    const r = await processarEventoAssinatura(a as never, payload("subscription.renewed"));

    expect(r.ok).toBe(true);
    expect(r.mensagem).toBe("cobranca renovada");
    expect(chamada(a, "fn_cobranca_renovar")?.args.p_subscription_id).toBe("subs_1");
    expect(chamada(a, "fn_cobranca_registrar")).toBeUndefined();
  });

  it("subscription.cancelled sem pedido do app registra o alerta no log", async () => {
    const a = admin({
      cobranca: { id: "c1", obra_id: OBRA, status: "ativa" },
      rpc: { fn_cobranca_cancelada_webhook: { data: { resultado: "cancelada_sem_pedido" } } },
    });
    const r = await processarEventoAssinatura(a as never, payload("subscription.cancelled"));

    expect(r.ok).toBe(true);
    expect(a.logUpdates.at(-1)).toMatchObject({
      processado: true,
      erro: "CANCELADA_SEM_PEDIDO",
    });
  });

  it("subscription.cancelled pedido pelo app não gera alerta", async () => {
    const a = admin({
      cobranca: { id: "c1", obra_id: OBRA, status: "cancelamento_agendado" },
      rpc: { fn_cobranca_cancelada_webhook: { data: { resultado: "ja_agendado" } } },
    });
    const r = await processarEventoAssinatura(a as never, payload("subscription.cancelled"));

    expect(r.ok).toBe(true);
    expect(a.logUpdates.at(-1)).toMatchObject({ processado: true, erro: null });
  });

  it("cobrança duplicada é erro permanente: registra e responde ok false sem lançar", async () => {
    const a = admin({
      obra: { id: OBRA },
      rpc: { fn_cobranca_registrar: { error: { message: "COBRANCA_DUPLICADA" } } },
    });
    const r = await processarEventoAssinatura(a as never, payload("subscription.completed"));

    expect(r.ok).toBe(false);
    expect(r.mensagem).toContain("COBRANCA_DUPLICADA");
    expect(a.logUpdates.at(-1)).toMatchObject({ processado: false });
  });

  it("erro transitório do banco é lançado para o provedor tentar de novo", async () => {
    const a = admin({
      obra: { id: OBRA },
      rpc: { fn_cobranca_registrar: { error: { message: "connection reset" } } },
    });
    await expect(
      processarEventoAssinatura(a as never, payload("subscription.completed")),
    ).rejects.toThrow();
  });

  it("externalId que não é obra nem assinatura da conta falha como ASSINATURA_AUSENTE", async () => {
    const a = admin();
    await expect(
      processarEventoAssinatura(a as never, payload("subscription.completed")),
    ).rejects.toThrow("ASSINATURA_AUSENTE");
  });

  it("trial_started sem obra identificada é ignorado (não é fluxo legado)", async () => {
    const a = admin();
    const r = await processarEventoAssinatura(a as never, payload("subscription.trial_started"));
    expect(r.ok).toBe(true);
    expect(r.mensagem).toContain("ignorado");
    expect(chamada(a, "fn_cobranca_registrar")).toBeUndefined();
  });
});
