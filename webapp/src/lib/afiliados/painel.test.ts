import { describe, expect, it } from "vitest";
import { parsearPainel } from "./painel";

const valido = {
  afiliado: true,
  config: { carenciaDias: 30, saqueMinimoCentavos: 5000 },
  saldo: { disponivelCentavos: 2598, pendenteCentavos: 1000, recebidoCentavos: 0, totalGanhoCentavos: 3598 },
  saqueAberto: false,
  links: [
    {
      id: "l1",
      codigo: "promo-joao",
      rotulo: "",
      ativo: true,
      comissaoBps: 2000,
      vitalicia: true,
      descontoBps: 1000,
      descontoDuracao: "primeira_fatura",
      cadastros: 2,
      assinantes: 1,
      ativos: 1,
      ganhosCentavos: 3598,
    },
  ],
  comissoes: [
    { id: "c1", em: "2026-10-01T10:00:00Z", linkCodigo: "promo-joao", valorCentavos: 2598, disponivelEm: "2026-10-31T10:00:00Z", status: "pendente" },
  ],
  saques: [],
};

describe("parsearPainel", () => {
  it("aceita o contrato da RPC", () => {
    expect(parsearPainel(valido)?.links[0].codigo).toBe("promo-joao");
  });

  it("rejeita quem não é afiliado e respostas fora do contrato", () => {
    expect(parsearPainel({ afiliado: false })).toBeNull();
    expect(parsearPainel(null)).toBeNull();
    expect(parsearPainel({ ...valido, saldo: { disponivelCentavos: "1" } })).toBeNull();
    expect(parsearPainel({ ...valido, links: [{ ...valido.links[0], descontoDuracao: "sempre" }] })).toBeNull();
  });
});
