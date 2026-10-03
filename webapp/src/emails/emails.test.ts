import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { ConviteAcessoEmail } from "@/emails/convite-acesso";
import { NovoRelatorioEmail } from "@/emails/novo-relatorio";
import { PagamentoPendenteEmail } from "@/emails/pagamento-pendente";

describe("templates de e-mail", () => {
  it("convite-acesso renderiza elemento", () => {
    const el = createElement(ConviteAcessoEmail, {
      empreiteiro: "Estevão",
      obraNome: "Residência de Francisco",
      link: "http://localhost:3000/entrar",
    });
    expect(el.type).toBe(ConviteAcessoEmail);
    expect(el.props.obraNome).toBe("Residência de Francisco");
  });

  it("novo-relatorio renderiza elemento", () => {
    const el = createElement(NovoRelatorioEmail, {
      obraNome: "Residência de Francisco",
      numero: 3,
      avancoAntes: 20,
      avancoDepois: 24,
      link: "http://localhost:3000/c/x",
    });
    expect(el.type).toBe(NovoRelatorioEmail);
    expect(el.props.numero).toBe(3);
  });

  it("pagamento-pendente renderiza elemento", () => {
    const el = createElement(PagamentoPendenteEmail, {
      obraNome: "Residência de Francisco",
      limite: "17/10",
      link: "http://localhost:3000/planos",
    });
    expect(el.type).toBe(PagamentoPendenteEmail);
    expect(el.props.limite).toBe("17/10");
  });
});
