import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIAS_RECUPERACAO } from "@/lib/cobranca/constantes";
import { executarJobCobranca } from "@/lib/cobranca/job";

const enviarEmailPagamentoPendente = vi.fn();
vi.mock("@/lib/email/enviar", () => ({
  enviarEmailPagamentoPendente: (...a: unknown[]) => enviarEmailPagamentoPendente(...a),
}));

function admin(opcoes: {
  rpc: { data?: unknown; error?: { message: string } | null };
  emails?: Record<string, string | null>;
}) {
  return {
    rpc: vi.fn(async () => ({ data: opcoes.rpc.data ?? null, error: opcoes.rpc.error ?? null })),
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { nome: "Residência Acácias" } }) }),
      }),
    })),
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { email: opcoes.emails?.[id] ?? null } },
        })),
      },
    },
  };
}

const retorno = (novas: Array<{ userId: string; obraId: string }>) => ({
  novasInadimplentes: novas.map((n, i) => ({ cobrancaId: `c${i}`, ...n })),
  canceladasPorFimDoPeriodo: 2,
  canceladasPorInadimplencia: 1,
});

beforeEach(() => enviarEmailPagamentoPendente.mockReset());

describe("executarJobCobranca", () => {
  it("avisa por e-mail o dono de cada obra que ficou inadimplente", async () => {
    const a = admin({
      rpc: { data: retorno([{ userId: "u1", obraId: "o1" }, { userId: "u2", obraId: "o2" }]) },
      emails: { u1: "a@example.com", u2: "b@example.com" },
    });
    const agora = new Date("2026-10-20T12:00:00Z");
    const r = await executarJobCobranca(a as never, agora);

    expect(r).toEqual({
      novasInadimplentes: 2,
      emailsEnviados: 2,
      canceladasPorFimDoPeriodo: 2,
      canceladasPorInadimplencia: 1,
    });
    expect(enviarEmailPagamentoPendente).toHaveBeenCalledTimes(2);
    expect(enviarEmailPagamentoPendente).toHaveBeenCalledWith({
      para: "a@example.com",
      obraNome: "Residência Acácias",
      limite: "03/11", // 20/10 + 14 dias
    });
    expect(a.rpc).toHaveBeenCalledWith("fn_cobranca_job_diario", {
      p_agora: agora.toISOString(),
    });
    expect(DIAS_RECUPERACAO).toBe(14);
  });

  it("pula o aviso de quem não tem e-mail e segue com os demais", async () => {
    const a = admin({
      rpc: { data: retorno([{ userId: "u1", obraId: "o1" }, { userId: "u2", obraId: "o2" }]) },
      emails: { u2: "b@example.com" },
    });
    const r = await executarJobCobranca(a as never);
    expect(r.novasInadimplentes).toBe(2);
    expect(r.emailsEnviados).toBe(1);
  });

  it("falha ao enviar um e-mail não derruba o job", async () => {
    enviarEmailPagamentoPendente.mockRejectedValueOnce(new Error("resend fora"));
    const a = admin({
      rpc: { data: retorno([{ userId: "u1", obraId: "o1" }, { userId: "u2", obraId: "o2" }]) },
      emails: { u1: "a@example.com", u2: "b@example.com" },
    });
    const r = await executarJobCobranca(a as never);
    expect(r.emailsEnviados).toBe(1);
  });

  it("sem novas inadimplentes não envia e-mail", async () => {
    const a = admin({ rpc: { data: retorno([]) } });
    const r = await executarJobCobranca(a as never);
    expect(r.emailsEnviados).toBe(0);
    expect(enviarEmailPagamentoPendente).not.toHaveBeenCalled();
  });

  it("erro do banco no job é lançado", async () => {
    const a = admin({ rpc: { error: { message: "falha" } } });
    await expect(executarJobCobranca(a as never)).rejects.toThrow();
  });
});
