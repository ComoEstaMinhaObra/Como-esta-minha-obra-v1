import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ABACATEPAY_PUBLIC_KEY,
  validateWebhookSignature,
  WEBHOOK_SIGNATURE_HEADER,
} from "@/lib/abacatepay-signature";
import {
  extrairExternalIdAssinatura,
  type WebhookPayload,
} from "@/lib/abacatepay-webhook";

const SECRET = "teste-webhook-secret";

function assinar(body: string): string {
  return createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
    .update(Buffer.from(body, "utf8"))
    .digest("base64");
}

describe("validateWebhookSignature", () => {
  it("aceita HMAC-SHA256 base64 com chave publica", () => {
    const body = '{"event":"subscription.completed"}';
    expect(validateWebhookSignature(body, assinar(body))).toBe(true);
  });

  it("rejeita assinatura invalida", () => {
    const body = '{"event":"subscription.completed"}';
    expect(validateWebhookSignature(body, "deadbeef")).toBe(false);
  });

  it("rejeita header ausente", () => {
    expect(validateWebhookSignature("{}", null)).toBe(false);
  });
});

describe("extracao de payload", () => {
  it("extrai externalId do checkout", () => {
    const payload: WebhookPayload = {
      data: { checkout: { externalId: "uuid-assinatura" } },
    };
    expect(extrairExternalIdAssinatura(payload)).toBe("uuid-assinatura");
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
    rpc: vi.fn(async (fn: string) => {
      if (fn === "fn_claim_webhook_evento") {
        return { data: { logId: "log-1", duplicado: false }, error: null };
      }
      if (fn === "fn_enfileirar_renovacao_emails") {
        return { data: { outboxIds: [] }, error: null };
      }
      return { data: null, error: null };
    }),
    from: vi.fn((table: string) => {
      if (table === "webhooks_log") {
        return {
          select: vi.fn(() => chain({ data: [] })),
          insert: vi.fn(() =>
            chain({ data: { id: "log-1" }, error: null }),
          ),
          update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
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
      return { select: vi.fn(() => chain({ data: null })) };
    }),
    _update: update,
    _updateEq: updateEq,
  };
}

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
      new Request(
        `http://localhost/api/webhooks/abacatepay?webhookSecret=${SECRET}`,
        {
          method: "POST",
          headers: {
            [WEBHOOK_SIGNATURE_HEADER]: "assinatura-errada",
            "Content-Type": "application/json",
          },
          body,
        },
      ),
    );
    expect(res.status).toBe(401);
  });

  it("webhookSecret invalido → 401", async () => {
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
      new Request(
        "http://localhost/api/webhooks/abacatepay?webhookSecret=errado",
        {
          method: "POST",
          headers: {
            [WEBHOOK_SIGNATURE_HEADER]: assinar(body),
            "Content-Type": "application/json",
          },
          body,
        },
      ),
    );
    expect(res.status).toBe(401);
  });

  it("HMAC valido processa o evento (aqui, um evento ignorado)", async () => {
    const admin = mockAdmin(null);

    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: () => admin,
    }));

    const { POST } = await import("@/app/api/webhooks/abacatepay/route");
    const body = JSON.stringify({
      id: "log_ok",
      event: "checkout.completed",
      data: {
        checkout: { externalId: "x" },
      },
    });
    const res = await POST(
      new Request(
        `http://localhost/api/webhooks/abacatepay?webhookSecret=${SECRET}`,
        {
          method: "POST",
          headers: {
            [WEBHOOK_SIGNATURE_HEADER]: assinar(body),
            "Content-Type": "application/json",
          },
          body,
        },
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean };
    expect(json.ok).toBe(true);
  });
});
