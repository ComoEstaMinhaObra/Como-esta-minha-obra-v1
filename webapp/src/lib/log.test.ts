import { describe, expect, it } from "vitest";
import { sanitizarErro } from "@/lib/log";
import { codigoRpc } from "@/lib/rpc-erros";

describe("log seguro", () => {
  it("remove e-mail e palavras proibidas", () => {
    expect(sanitizarErro("falha token abc user@site.com")).not.toMatch(/@/);
    expect(sanitizarErro("SQLSTATE 23505")).toContain("[redigido]");
  });
});

describe("codigoRpc", () => {
  it("extrai código estável", () => {
    expect(codigoRpc({ message: "RATE_LIMITED" })).toBe("RATE_LIMITED");
    expect(codigoRpc({ message: "boom" })).toBe("ERRO_GENERICO");
  });
});
