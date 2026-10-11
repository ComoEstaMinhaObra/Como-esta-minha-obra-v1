import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const processar = vi.fn();
vi.mock("@/lib/cobranca/mercadopago-webhook", () => ({
  processarNotificacaoMp: (...a: unknown[]) => processar(...a),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ admin: true }) }));
vi.mock("@/lib/log", () => ({ logSeguro: vi.fn(), sanitizarErro: () => "erro" }));

import { montarManifestMp } from "@/lib/mercadopago-signature";
import { POST } from "./route";

const SEGREDO = "segredo-webhook-teste";

function pedido(opcoes: { dataId?: string; corpo?: unknown; assinar?: boolean; segredo?: string }) {
  const dataId = opcoes.dataId ?? "abc123";
  const ts = "1742505638683";
  const requestId = "req-1";
  const v1 = createHmac("sha256", opcoes.segredo ?? SEGREDO)
    .update(montarManifestMp(dataId, requestId, ts))
    .digest("hex");
  const headers: Record<string, string> = { "x-request-id": requestId };
  if (opcoes.assinar !== false) headers["x-signature"] = `ts=${ts},v1=${v1}`;
  return new Request(`https://staging.exemplo.com/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_preapproval`, {
    method: "POST",
    headers,
    body: JSON.stringify(opcoes.corpo ?? { type: "subscription_preapproval", action: "updated", data: { id: dataId } }),
  });
}

beforeEach(() => {
  processar.mockReset();
  vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "APP_USR-token");
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SEGREDO);
});

describe("POST /api/webhooks/mercadopago", () => {
  it("rejeita notificação sem assinatura ou com assinatura de outro segredo", async () => {
    expect((await POST(pedido({ assinar: false }))).status).toBe(401);
    expect((await POST(pedido({ segredo: "outro" }))).status).toBe(401);
    expect(processar).not.toHaveBeenCalled();
  });

  it("rejeita corpo que não é JSON", async () => {
    const req = new Request("https://staging.exemplo.com/api/webhooks/mercadopago?data.id=1", {
      method: "POST",
      body: "isto não é json",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("assinatura válida chama o processador com o tipo e o id do recurso", async () => {
    processar.mockResolvedValue({ ok: true, mensagem: "cobranca renovada" });
    const res = await POST(pedido({}));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, mensagem: "cobranca renovada" });
    expect(processar).toHaveBeenCalledWith(
      { admin: true },
      { tipo: "subscription_preapproval", dataId: "abc123", acao: "updated" },
    );
  });

  it("falha transitória devolve 5xx para o provedor reenviar", async () => {
    processar.mockRejectedValue(new Error("banco fora"));
    const res = await POST(pedido({}));
    expect(res.status).toBe(500);
  });
});
