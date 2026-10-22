import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const exchangeCodeForSession = vi.fn();
const getUser = vi.fn();
let cookieRef: string | undefined;

const consulta: Record<string, unknown> = {};
for (const metodo of ["select", "eq", "order", "is"]) {
  consulta[metodo] = () => consulta;
}
consulta.limit = async () => ({ data: [] });

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession, getUser },
    rpc,
    from: () => consulta,
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nome: string) =>
      nome === "cemo_ref" && cookieRef !== undefined ? { value: cookieRef } : undefined,
  }),
}));
vi.mock("@/lib/log", () => ({ logSeguro: vi.fn() }));

import { GET } from "./route";

const BASE = "https://comoestaminhaobra.com.br";

function chamar(query = "") {
  return GET(new Request(`${BASE}/auth/callback${query}`));
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieRef = undefined;
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    exchangeCodeForSession.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: { atribuida: true }, error: null });
  });

  it("atribui a indicação do cookie e limpa o cookie", async () => {
    cookieRef = "promo-joao";
    const res = await chamar();
    expect(rpc).toHaveBeenCalledWith("fn_afiliado_registrar_indicacao", {
      p_codigo: "promo-joao",
    });
    expect(res.headers.get("location")).toBe(`${BASE}/obras`);
    expect(res.headers.get("set-cookie")).toContain("cemo_ref=;");
  });

  it("sem cookie não chama o banco nem mexe em cookie", async () => {
    const res = await chamar();
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("cookie com formato inválido não chega ao banco, mas é limpo", async () => {
    cookieRef = "x";
    const res = await chamar();
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toContain("cemo_ref=;");
  });

  it("erro na atribuição não bloqueia o login", async () => {
    cookieRef = "promo-joao";
    rpc.mockResolvedValue({ data: null, error: { message: "falhou" } });
    const res = await chamar();
    expect(res.headers.get("location")).toBe(`${BASE}/obras`);
  });

  it("exceção na atribuição não bloqueia o login", async () => {
    cookieRef = "promo-joao";
    rpc.mockRejectedValue(new Error("rede"));
    const res = await chamar();
    expect(res.headers.get("location")).toBe(`${BASE}/obras`);
  });

  it("honra ?next= e ainda atribui", async () => {
    cookieRef = "promo-joao";
    const res = await chamar("?next=/conta");
    expect(rpc).toHaveBeenCalled();
    expect(res.headers.get("location")).toBe(`${BASE}/conta`);
  });

  it("falha na troca do código mantém o cookie para a próxima tentativa", async () => {
    cookieRef = "promo-joao";
    exchangeCodeForSession.mockResolvedValue({ error: { message: "pkce" } });
    const res = await chamar("?code=abc");
    expect(res.headers.get("location")).toBe(`${BASE}/entrar?erro=auth`);
    expect(rpc).not.toHaveBeenCalled();
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sem usuário volta para a entrada sem atribuir", async () => {
    cookieRef = "promo-joao";
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await chamar();
    expect(res.headers.get("location")).toBe(`${BASE}/entrar?erro=auth`);
    expect(rpc).not.toHaveBeenCalled();
  });
});
