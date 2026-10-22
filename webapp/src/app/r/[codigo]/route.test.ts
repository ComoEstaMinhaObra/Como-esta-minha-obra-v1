import { describe, expect, it } from "vitest";
import { GET } from "./route";

function chamar(codigo: string, query = "") {
  return GET(new Request(`https://comoestaminhaobra.com.br/r/${codigo}${query}`), {
    params: Promise.resolve({ codigo }),
  });
}

describe("GET /r/[codigo]", () => {
  it("guarda o código no cookie e redireciona para a página inicial", async () => {
    const res = await chamar("Promo-Joao");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://comoestaminhaobra.com.br/");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("cemo_ref=promo-joao");
    expect(cookie).toContain("HttpOnly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("Path=/");
  });

  it("mantém a query da campanha", async () => {
    const res = await chamar("promo-joao", "?utm_source=ig");
    expect(res.headers.get("location")).toBe(
      "https://comoestaminhaobra.com.br/?utm_source=ig",
    );
  });

  it("código inválido redireciona sem gravar cookie", async () => {
    const res = await chamar("a");
    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
