import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssinaturaMp, ParcelaMp } from "@/lib/mercadopago";
import {
  interpretarEstado,
  podeRegistrar,
  processarNotificacaoMp,
  registrarCobrancaAssinatura,
  TOPICO_ASSINATURA,
  TOPICO_PARCELA,
} from "./mercadopago-webhook";

vi.mock("@/config/pricing", () => ({ OBRA_ATIVA: { precoCentavos: 12990 } }));
vi.mock("@/lib/cobranca/job", () => ({ avisarPagamentoPendente: vi.fn() }));
vi.mock("@/lib/mercadopago", () => ({
  consultarAssinatura: vi.fn(),
  consultarParcela: vi.fn(),
}));

const OBRA = "11111111-1111-4111-8111-111111111111";
const AGORA = new Date("2026-10-11T13:00:00Z");

function assinatura(extra: Partial<AssinaturaMp> = {}): AssinaturaMp {
  return {
    id: "mp_1",
    status: "authorized",
    external_reference: OBRA,
    date_created: "2026-10-11T09:44:29.000-04:00",
    last_modified: "2026-10-11T09:44:30.315-04:00",
    next_payment_date: "2026-11-11T09:44:30.000-04:00",
    summarized: { charged_quantity: 1 },
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 129.9,
      currency_id: "BRL",
    },
    ...extra,
  };
}

function parcela(extra: Partial<ParcelaMp> = {}): ParcelaMp {
  return {
    id: 99,
    preapproval_id: "mp_1",
    status: "processed",
    payment: { id: 1, status: "approved", status_detail: "accredited" },
    last_modified: "2026-10-11T09:44:30.000-04:00",
    ...extra,
  };
}

describe("interpretarEstado", () => {
  it("assinatura cancelada vira cancelada, qualquer que seja a parcela", () => {
    expect(interpretarEstado(assinatura({ status: "cancelled" }), null)).toEqual({ tipo: "cancelada" });
    expect(interpretarEstado(assinatura({ status: "cancelled" }), parcela())).toEqual({ tipo: "cancelada" });
  });

  it("pendente ou pausada é ignorada", () => {
    expect(interpretarEstado(assinatura({ status: "pending" }), null).tipo).toBe("ignorado");
    expect(interpretarEstado(assinatura({ status: "paused" }), null).tipo).toBe("ignorado");
  });

  it("assinatura autorizada sem parcela é autorizada", () => {
    expect(interpretarEstado(assinatura(), null)).toEqual({ tipo: "autorizada" });
  });

  it("parcela processada e aprovada é paga", () => {
    expect(interpretarEstado(assinatura(), parcela())).toEqual({ tipo: "paga" });
  });

  it("parcela em nova tentativa ou recusada de vez é falha", () => {
    expect(
      interpretarEstado(assinatura(), parcela({ status: "recycling", payment: { status: "rejected" } })),
    ).toEqual({ tipo: "falhou" });
    expect(
      interpretarEstado(assinatura(), parcela({ status: "processed", payment: { status: "rejected" } })),
    ).toEqual({ tipo: "falhou" });
  });

  it("parcela agendada ou aguardando não faz nada", () => {
    expect(interpretarEstado(assinatura(), parcela({ status: "scheduled", payment: undefined })).tipo).toBe(
      "ignorado",
    );
  });
});

describe("podeRegistrar", () => {
  it("exige a 1ª parcela paga", () => {
    expect(podeRegistrar(assinatura(), AGORA)).toBe(true);
    expect(podeRegistrar(assinatura({ summarized: { charged_quantity: 0 } }), AGORA)).toBe(false);
    expect(podeRegistrar(assinatura({ summarized: null }), AGORA)).toBe(false);
  });

  it("aceita a primeira cobrança adiada no futuro (free_trial)", () => {
    const trial = assinatura({
      summarized: { charged_quantity: null },
      next_payment_date: "2026-10-20T09:44:46.000-04:00",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 129.9,
        currency_id: "BRL",
        free_trial: { frequency: 9, frequency_type: "days" },
      },
    });
    expect(podeRegistrar(trial, AGORA)).toBe(true);
    expect(podeRegistrar(trial, new Date("2026-10-25T00:00:00Z"))).toBe(false);
  });

  it("assinatura que não está autorizada não registra", () => {
    expect(podeRegistrar(assinatura({ status: "pending" }), AGORA)).toBe(false);
  });
});

type Rpc = (nome: string, args: Record<string, unknown>) => { data?: unknown; error?: { message: string } | null };

function fakeAdmin(opcoes: {
  rpc?: Rpc;
  cobranca?: { id: string; obraId: string; status: string } | null;
  obra?: { id: string } | null;
}) {
  const logs: Array<Record<string, unknown>> = [];
  const rpc = vi.fn(async (nome: string, args: Record<string, unknown>) => {
    if (nome === "fn_claim_webhook_evento") {
      return { data: { logId: "log1", duplicado: false }, error: null };
    }
    if (nome === "fn_cobranca_por_assinatura") {
      return { data: opcoes.cobranca ?? null, error: null };
    }
    const r = opcoes.rpc?.(nome, args);
    return { data: r?.data ?? null, error: r?.error ?? null };
  });
  const from = vi.fn((tabela: string) => {
    if (tabela === "webhooks_log") {
      return {
        update: (v: Record<string, unknown>) => {
          logs.push(v);
          return { eq: async () => ({}) };
        },
      };
    }
    const dado = opcoes.obra ?? null;
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.eq = () => q;
    q.maybeSingle = async () => ({ data: dado });
    return q;
  });
  return { admin: { rpc, from } as never, rpc, logs };
}

const chamou = (rpc: ReturnType<typeof vi.fn>, nome: string) =>
  rpc.mock.calls.find((c) => c[0] === nome)?.[1] as Record<string, unknown> | undefined;

function deps(a: AssinaturaMp, p?: ParcelaMp) {
  return {
    consultarAssinatura: vi.fn(async () => a),
    consultarParcela: vi.fn(async () => p as ParcelaMp),
    avisarPagamentoPendente: vi.fn(async () => true),
    agora: () => AGORA,
  };
}

describe("processarNotificacaoMp", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignora tipos que o app não usa, sem consultar a API", async () => {
    const f = fakeAdmin({});
    const d = deps(assinatura());
    const r = await processarNotificacaoMp(f.admin, { tipo: "payment", dataId: "1" }, { deps: d });
    expect(r).toEqual({ ok: true, mensagem: "evento ignorado: payment" });
    expect(d.consultarAssinatura).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });

  it("assinatura autorizada e paga registra a cobrança com o fim do período do provedor", async () => {
    const f = fakeAdmin({
      obra: { id: OBRA },
      rpc: (nome) => (nome === "fn_cobranca_registrar" ? { data: { criada: true } } : {}),
    });
    const r = await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura()) },
    );
    expect(r.ok).toBe(true);
    const args = chamou(f.rpc, "fn_cobranca_registrar");
    expect(args).toMatchObject({
      p_obra: OBRA,
      p_subscription_id: "mp_1",
      p_valor_centavos: 12990,
      p_primeira_cobranca_em: null,
    });
    expect(new Date(args!.p_periodo_fim as string).toISOString()).toBe("2026-11-11T13:44:30.000Z");
    expect(chamou(f.rpc, "fn_claim_webhook_evento")).toMatchObject({
      p_provedor: "mercadopago",
      p_evento: TOPICO_ASSINATURA,
    });
  });

  it("a mesma notificação repetida não processa duas vezes", async () => {
    const f = fakeAdmin({});
    f.rpc.mockResolvedValueOnce({ data: { logId: "log1", duplicado: true }, error: null });
    const r = await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura()) },
    );
    expect(r.mensagem).toMatch(/idempotente/);
    expect(chamou(f.rpc, "fn_cobranca_registrar")).toBeUndefined();
  });

  it("o id do evento inclui o estado consultado", async () => {
    const f = fakeAdmin({ cobranca: { id: "c", obraId: OBRA, status: "ativa" } });
    await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura()) },
    );
    expect(chamou(f.rpc, "fn_claim_webhook_evento")!.p_event_id).toBe(
      "assinatura:mp_1:authorized:2026-10-11T09:44:30.315-04:00",
    );
  });

  it("reprocessar pelo admin reaproveita o id do log original", async () => {
    const f = fakeAdmin({ cobranca: { id: "c", obraId: OBRA, status: "ativa" } });
    await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { forcar: true, eventId: "id-original", deps: deps(assinatura()) },
    );
    expect(chamou(f.rpc, "fn_claim_webhook_evento")).toMatchObject({
      p_event_id: "id-original",
      p_force: true,
    });
  });

  it("assinatura autorizada sem cobrança paga aguarda a primeira parcela", async () => {
    const f = fakeAdmin({});
    const r = await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura({ summarized: { charged_quantity: 0 } })) },
    );
    expect(r.mensagem).toBe("aguardando a primeira cobranca");
    expect(chamou(f.rpc, "fn_cobranca_registrar")).toBeUndefined();
  });

  it("parcela paga de cobrança existente renova com o próximo vencimento", async () => {
    const f = fakeAdmin({
      cobranca: { id: "c", obraId: OBRA, status: "inadimplente" },
      rpc: (nome) => (nome === "fn_cobranca_renovar" ? { data: { alterada: true } } : {}),
    });
    const r = await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_PARCELA, dataId: "99" },
      { deps: deps(assinatura(), parcela()) },
    );
    expect(r.mensagem).toBe("cobranca renovada");
    expect(chamou(f.rpc, "fn_cobranca_renovar")).toMatchObject({
      p_subscription_id: "mp_1",
      p_periodo_fim: "2026-11-11T09:44:30.000-04:00",
    });
  });

  it("parcela paga que chega antes do registro registra a cobrança", async () => {
    const f = fakeAdmin({
      obra: { id: OBRA },
      rpc: (nome) => (nome === "fn_cobranca_registrar" ? { data: { criada: true } } : {}),
    });
    await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_PARCELA, dataId: "99" },
      { deps: deps(assinatura(), parcela()) },
    );
    expect(chamou(f.rpc, "fn_cobranca_registrar")).toBeDefined();
    expect(chamou(f.rpc, "fn_cobranca_renovar")).toBeUndefined();
  });

  it("parcela recusada marca a obra como inadimplente e avisa o dono", async () => {
    const f = fakeAdmin({
      cobranca: { id: "c", obraId: OBRA, status: "ativa" },
      rpc: (nome) =>
        nome === "fn_cobranca_marcar_inadimplente"
          ? { data: { alterada: true, userId: "u1", obraId: OBRA } }
          : {},
    });
    const d = deps(assinatura(), parcela({ status: "recycling", payment: { status: "rejected" } }));
    const r = await processarNotificacaoMp(f.admin, { tipo: TOPICO_PARCELA, dataId: "99" }, { deps: d });
    expect(r.mensagem).toBe("cobranca inadimplente");
    expect(d.avisarPagamentoPendente).toHaveBeenCalledWith(f.admin, {
      userId: "u1",
      obraId: OBRA,
      agora: AGORA,
    });
  });

  it("falha repetida de uma obra que já está inadimplente não manda outro e-mail", async () => {
    const f = fakeAdmin({
      cobranca: { id: "c", obraId: OBRA, status: "inadimplente" },
      rpc: (nome) =>
        nome === "fn_cobranca_marcar_inadimplente" ? { data: { alterada: false } } : {},
    });
    const d = deps(assinatura(), parcela({ status: "recycling", payment: { status: "rejected" } }));
    await processarNotificacaoMp(f.admin, { tipo: TOPICO_PARCELA, dataId: "99" }, { deps: d });
    expect(d.avisarPagamentoPendente).not.toHaveBeenCalled();
  });

  it("assinatura cancelada com cobrança chama o cancelamento; sem cobrança é ignorada", async () => {
    const com = fakeAdmin({
      cobranca: { id: "c", obraId: OBRA, status: "ativa" },
      rpc: (nome) =>
        nome === "fn_cobranca_cancelada_webhook" ? { data: { resultado: "agendado_pelo_app" } } : {},
    });
    const r1 = await processarNotificacaoMp(
      com.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura({ status: "cancelled" })) },
    );
    expect(r1.mensagem).toBe("cobranca: agendado_pelo_app");

    const sem = fakeAdmin({});
    const r2 = await processarNotificacaoMp(
      sem.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura({ status: "cancelled" })) },
    );
    expect(r2.ok).toBe(true);
    expect(chamou(sem.rpc, "fn_cobranca_cancelada_webhook")).toBeUndefined();
  });

  it("cancelamento sem pedido do app fica marcado para o admin conferir", async () => {
    const f = fakeAdmin({
      cobranca: { id: "c", obraId: OBRA, status: "ativa" },
      rpc: (nome) =>
        nome === "fn_cobranca_cancelada_webhook" ? { data: { resultado: "cancelada_sem_pedido" } } : {},
    });
    await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura({ status: "cancelled" })) },
    );
    expect(f.logs.some((l) => l.erro === "CANCELADA_SEM_PEDIDO")).toBe(true);
  });

  it("obra inexistente é erro permanente: log e resposta sem retentativa", async () => {
    const f = fakeAdmin({ obra: null });
    const r = await processarNotificacaoMp(
      f.admin,
      { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
      { deps: deps(assinatura()) },
    );
    expect(r).toEqual({ ok: false, mensagem: "OBRA_AUSENTE" });
    expect(f.logs.some((l) => l.erro === "OBRA_AUSENTE" && l.processado === false)).toBe(true);
  });

  it("COBRANCA_DUPLICADA é transitória: lança para o provedor reenviar", async () => {
    const f = fakeAdmin({
      obra: { id: OBRA },
      rpc: (nome) =>
        nome === "fn_cobranca_registrar" ? { error: { message: "COBRANCA_DUPLICADA" } } : {},
    });
    await expect(
      processarNotificacaoMp(
        f.admin,
        { tipo: TOPICO_ASSINATURA, dataId: "mp_1" },
        { deps: deps(assinatura()) },
      ),
    ).rejects.toThrow();
    expect(f.logs.some((l) => l.processado === false && typeof l.erro === "string")).toBe(true);
  });

  it("falha ao consultar a API lança sem gravar nada", async () => {
    const f = fakeAdmin({});
    const d = deps(assinatura());
    d.consultarAssinatura.mockRejectedValue(new Error("api fora"));
    await expect(
      processarNotificacaoMp(f.admin, { tipo: TOPICO_ASSINATURA, dataId: "mp_1" }, { deps: d }),
    ).rejects.toThrow("api fora");
    expect(f.rpc).not.toHaveBeenCalled();
  });
});

describe("registrarCobrancaAssinatura", () => {
  it("trial: guarda a primeira cobrança adiada e o fim do período", async () => {
    const f = fakeAdmin({
      obra: { id: OBRA },
      rpc: () => ({ data: { criada: true } }),
    });
    const trial = assinatura({
      summarized: { charged_quantity: null },
      next_payment_date: "2026-10-20T09:44:46.000-04:00",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 129.9,
        currency_id: "BRL",
        free_trial: { frequency: 9, frequency_type: "days" },
      },
    });
    const r = await registrarCobrancaAssinatura(f.admin, trial, AGORA);
    expect(r).toEqual({ ok: true, criada: true });
    const args = chamou(f.rpc, "fn_cobranca_registrar")!;
    expect(args.p_primeira_cobranca_em).toBe(args.p_periodo_fim);
  });

  it("external_reference que não é id de obra não registra", async () => {
    const f = fakeAdmin({});
    const r = await registrarCobrancaAssinatura(f.admin, assinatura({ external_reference: "spike-1" }), AGORA);
    expect(r).toEqual({ ok: false, erro: "OBRA_AUSENTE" });
  });
});
