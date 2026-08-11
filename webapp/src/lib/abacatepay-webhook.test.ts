import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  validateWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/lib/abacatepay-signature";
import {
  extrairExternalIdAssinatura,
  extrairProdutoId,
  processarEventoAssinatura,
  type WebhookPayload,
} from "@/lib/abacatepay-webhook";

const SECRET = "teste-webhook-secret";

function assinar(body: string): string {
  return createHmac("sha256", SECRET).update(body, "utf8").digest("hex");
}

describe("validateWebhookSignature", () => {
  it("aceita HMAC-SHA256 hex valido", () => {
    const body = '{"event":"subscription.completed"}';
    expect(validateWebhookSignature(body, assinar(body), SECRET)).toBe(true);
  });

  it("rejeita assinatura invalida", () => {
    const body = '{"event":"subscription.completed"}';
    expect(validateWebhookSignature(body, "deadbeef", SECRET)).toBe(false);
  });

  it("rejeita header ausente", () => {
    expect(validateWebhookSignature("{}", null, SECRET)).toBe(false);
  });
});

describe("extracao de payload", () => {
  it("extrai externalId do checkout", () => {
    const payload: WebhookPayload = {
      data: { checkout: { externalId: "uuid-assinatura" } },
    };
    expect(extrairExternalIdAssinatura(payload)).toBe("uuid-assinatura");
  });

  it("extrai produto do checkout.items", () => {
    const payload: WebhookPayload = {
      data: {
        checkout: { items: [{ id: "prod_obra3", quantity: 1 }] },
      },
    };
    expect(extrairProdutoId(payload)).toBe("prod_obra3");
  });
});

/** Builder encadeável estilo supabase query (thenable). */
function chain(result: unknown) {
  const api: Record<string, unknown> = {};
  const self = new Proxy(api, {
    get(_t, prop: string | symbol) {
      if (prop === "then") {
        return (
          resolve: (v: unknown) => unknown,
          reject?: (e: unknown) => unknown,
        ) => Promise.resolve(result).then(resolve, reject);
      }
      if (prop === "maybeSingle" || prop === "single") {
        return vi.fn(async () => result);
      }
      return vi.fn(() => self);
    },
  });
  return self;
}

function mockAdmin(assinaturaRow: Record<string, unknown> | null) {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));

  return {
    from: vi.fn((table: string) => {
      if (table === "webhooks_log") {
        return {
          select: vi.fn(() => chain({ data: [] })),
          insert: vi.fn(() =>
            chain({ data: { id: "log-1" }, error: null }),
          ),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({}) })),
        };
      }
      if (table === "assinaturas") {
        return {
          select: vi.fn(() =>
            chain({ data: assinaturaRow, error: null }),
          ),
          update,
        };
      }
      if (table === "obras") {
        return {
          select: vi.fn(() => chain({ data: [] })),
        };
      }
      if (table === "obra_acessos") {
        return {
          select: vi.fn(() => chain({ count: 0, data: null })),
        };
      }
      if (table === "assinatura_usos") {
        return {
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      return { select: vi.fn(() => chain({ data: null })) };
    }),
    _update: update,
    _updateEq: updateEq,
  };
}

vi.mock("@/lib/abacatepay", () => ({
  limiteDoPlano: (id: string) =>
    id === "obra_1" ? 1 : id === "obra_3" ? 3 : 5,
  planoPorProdutoId: (id: string) =>
    id === "prod_1" ? "obra_1" : id === "prod_3" ? "obra_3" : null,
  produtoEmailExtraId: () => "prod_email",
  registrarUso: vi.fn().mockResolvedValue({
    id: "usgr_1",
    installmentNumber: 2,
  }),
}));

describe("processarEventoAssinatura", () => {
  it("subscription.completed ativa plano", async () => {
    const admin = mockAdmin({
      id: "asid",
      user_id: "uid",
      plano: "trial",
      status: "trial",
      abacatepay_subscription_id: null,
    });

    const payload: WebhookPayload = {
      id: "log_evt1",
      event: "subscription.completed",
      data: {
        subscription: { id: "subs_1", status: "ACTIVE" },
        checkout: {
          externalId: "asid",
          items: [{ id: "prod_3", quantity: 1 }],
        },
      },
    };

    const r = await processarEventoAssinatura(admin as never, payload);
    expect(r.ok).toBe(true);
    expect(admin._update).toHaveBeenCalled();
    expect(admin._updateEq).toHaveBeenCalledWith("id", "asid");
  });

  it("subscription.cancelled marca cancelada", async () => {
    const admin = mockAdmin({
      id: "asid",
      user_id: "uid",
      plano: "obra_3",
      status: "ativa",
      abacatepay_subscription_id: "subs_1",
    });

    const r = await processarEventoAssinatura(admin as never, {
      id: "log_evt2",
      event: "subscription.cancelled",
      data: {
        subscription: { id: "subs_1", status: "CANCELLED" },
      },
    });
    expect(r.ok).toBe(true);
    expect(admin._update).toHaveBeenCalled();
  });

  it("subscription.renewed garante ativa", async () => {
    const admin = mockAdmin({
      id: "asid",
      user_id: "uid",
      plano: "obra_3",
      status: "ativa",
      abacatepay_subscription_id: "subs_1",
    });

    const r = await processarEventoAssinatura(admin as never, {
      id: "log_evt3",
      event: "subscription.renewed",
      data: {
        subscription: { id: "subs_1", status: "ACTIVE" },
      },
    });
    expect(r.ok).toBe(true);
    expect(admin._update).toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/abacatepay", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ABACATEPAY_WEBHOOK_SECRET = SECRET;
  });

  it("HMAC invalido → 401", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => mockAdmin(null),
    }));

    const { POST } = await import("@/app/api/webhooks/abacatepay/route");
    const body = JSON.stringify({
      id: "log_x",
      event: "subscription.completed",
      data: {},
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/abacatepay", {
        method: "POST",
        headers: {
          [WEBHOOK_SIGNATURE_HEADER]: "assinatura-errada",
          "Content-Type": "application/json",
        },
        body,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("HMAC valido processa completed", async () => {
    const admin = mockAdmin({
      id: "asid",
      user_id: "uid",
      plano: "trial",
      status: "trial",
      abacatepay_subscription_id: null,
    });

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => admin,
    }));
    vi.doMock("@/lib/abacatepay", () => ({
      limiteDoPlano: () => 3,
      planoPorProdutoId: () => "obra_3",
      produtoEmailExtraId: () => "prod_email",
      registrarUso: vi.fn(),
    }));

    const { POST } = await import("@/app/api/webhooks/abacatepay/route");
    const body = JSON.stringify({
      id: "log_ok",
      event: "subscription.completed",
      data: {
        subscription: { id: "subs_1" },
        checkout: {
          externalId: "asid",
          items: [{ id: "prod_3", quantity: 1 }],
        },
      },
    });
    const res = await POST(
      new Request("http://localhost/api/webhooks/abacatepay", {
        method: "POST",
        headers: {
          [WEBHOOK_SIGNATURE_HEADER]: assinar(body),
          "Content-Type": "application/json",
        },
        body,
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });
});
