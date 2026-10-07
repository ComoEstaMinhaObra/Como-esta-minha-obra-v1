import { describe, expect, it } from "vitest";
import {
  SEGUNDOS_ESPERA_REENVIO,
  rotuloReenvio,
  segundosRestantes,
} from "@/lib/auth/reenvio-confirmacao";
import {
  MENSAGEM_EMAIL_NAO_CONFIRMADO,
  emailNaoConfirmado,
  mensagemDeErro,
} from "@/lib/auth/mensagens-erro";
import { MENSAGEM_REGRA_SENHA } from "@/lib/auth/forca-senha";

describe("espera para reenviar a confirmação", () => {
  it("conta os segundos arredondando para cima e nunca fica negativa", () => {
    const inicio = 1_000_000;
    const liberado = inicio + SEGUNDOS_ESPERA_REENVIO * 1000;
    expect(segundosRestantes(liberado, inicio)).toBe(SEGUNDOS_ESPERA_REENVIO);
    expect(segundosRestantes(liberado, inicio + 59_500)).toBe(1);
    expect(segundosRestantes(liberado, liberado)).toBe(0);
    expect(segundosRestantes(liberado, liberado + 5_000)).toBe(0);
  });

  it("monta o rótulo do botão", () => {
    expect(rotuloReenvio(0, false)).toBe("Reenviar e-mail");
    expect(rotuloReenvio(42, false)).toBe("Reenviar e-mail em 42s");
    expect(rotuloReenvio(0, true)).toBe("Enviando…");
    expect(rotuloReenvio(42, true)).toBe("Enviando…");
  });
});

describe("mensagens de erro do login", () => {
  it("traduz os erros conhecidos", () => {
    expect(mensagemDeErro("Invalid login credentials")).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(mensagemDeErro("Email not confirmed")).toBe(
      MENSAGEM_EMAIL_NAO_CONFIRMADO,
    );
    expect(mensagemDeErro("Password should contain letters")).toBe(
      MENSAGEM_REGRA_SENHA,
    );
  });

  it("reconhece limite de envio pelo código ou pelo texto", () => {
    const limite = "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    expect(mensagemDeErro("qualquer", "over_email_send_rate_limit")).toBe(limite);
    expect(mensagemDeErro("email rate limit exceeded")).toBe(limite);
    expect(
      mensagemDeErro(
        "For security purposes, you can only request this after 20 seconds.",
      ),
    ).toBe(limite);
  });

  it("cai na mensagem genérica", () => {
    expect(mensagemDeErro("boom")).toBe(
      "Não foi possível concluir. Tente novamente.",
    );
  });

  it("detecta e-mail não confirmado", () => {
    expect(emailNaoConfirmado("Email not confirmed")).toBe(true);
    expect(emailNaoConfirmado("Invalid login credentials")).toBe(false);
  });
});
