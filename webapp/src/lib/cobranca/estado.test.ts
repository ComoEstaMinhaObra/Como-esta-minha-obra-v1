import { describe, expect, it } from "vitest";
import {
  montarResumoCobranca,
  type CobrancaLinhaDb,
  type ContaLinhaDb,
  type ObraLinhaDb,
} from "@/lib/cobranca/estado";

const AGORA = new Date("2026-10-03T12:00:00Z");
const dia = (n: number) => new Date(AGORA.getTime() + n * 86400000).toISOString();

const obra = (id: string, over: Partial<ObraLinhaDb> = {}): ObraLinhaDb => ({
  id,
  nome: `Obra ${id}`,
  arquivada_em: null,
  ...over,
});

const cobranca = (obra_id: string, over: Partial<CobrancaLinhaDb> = {}): CobrancaLinhaDb => ({
  obra_id,
  status: "ativa",
  valor_centavos: 12990,
  periodo_fim: dia(20),
  primeira_cobranca_em: null,
  inadimplente_desde: null,
  acesso_ate: null,
  criado_em: dia(-10),
  ...over,
});

const trial: ContaLinhaDb = { status: "trial", trial_fim: dia(11), relatorios_enviados_trial: 1 };

describe("montarResumoCobranca", () => {
  it("trial: a obra sem assinatura mostra o prazo do trial e pode ser contratada", () => {
    const r = montarResumoCobranca([obra("a")], [], trial, AGORA);
    expect(r.trial).toEqual({ diasRestantes: 11, relatoriosUsados: 1 });
    const l = r.linhas[0];
    expect(l.estado).toBe("sem_assinatura");
    expect(l.emTrialAte?.toISOString()).toBe(dia(11));
    expect(l.acoes).toMatchObject({ contratar: true, cancelar: false, reativar: false });
    expect(r.totalMensalCentavos).toBe(0);
  });

  it("trial vencido: sem aviso de trial, mas ainda pode contratar", () => {
    const r = montarResumoCobranca(
      [obra("a")],
      [],
      { ...trial, trial_fim: dia(-1) },
      AGORA,
    );
    expect(r.trial).toBeNull();
    expect(r.linhas[0].emTrialAte).toBeNull();
    expect(r.linhas[0].acoes.contratar).toBe(true);
  });

  it("cobrança ativa: valor, próxima cobrança e ação de cancelar; soma as obras", () => {
    const r = montarResumoCobranca(
      [obra("a"), obra("b")],
      [cobranca("a"), cobranca("b", { periodo_fim: dia(5) })],
      trial,
      AGORA,
    );
    expect(r.totalMensalCentavos).toBe(25980);
    expect(r.proximaCobranca?.toISOString()).toBe(dia(5));
    expect(r.trial).toBeNull(); // quem já pagou deixa o trial
    expect(r.linhas[0].acoes).toMatchObject({ cancelar: true, contratar: false });
  });

  it("primeira cobrança adiada: a próxima cobrança é a data do fim do trial do produto", () => {
    const r = montarResumoCobranca(
      [obra("a")],
      [cobranca("a", { primeira_cobranca_em: dia(12), periodo_fim: dia(12) })],
      trial,
      AGORA,
    );
    expect(r.linhas[0].primeiraCobrancaAdiada).toBe(true);
    expect(r.linhas[0].proximaCobranca?.toISOString()).toBe(dia(12));
  });

  it("inadimplente: sem ações e com o limite de 14 dias de recuperação", () => {
    const r = montarResumoCobranca(
      [obra("a")],
      [cobranca("a", { status: "inadimplente", inadimplente_desde: dia(-2) })],
      trial,
      AGORA,
    );
    const l = r.linhas[0];
    expect(l.estado).toBe("inadimplente");
    expect(l.limiteRecuperacao?.toISOString()).toBe(dia(12));
    expect(l.acoes).toEqual({ contratar: false, cancelar: false, reativar: false, reativarApos: null });
    expect(r.totalMensalCentavos).toBe(12990); // ainda será cobrada
  });

  it("cancelamento agendado: reativar bloqueado até acesso_ate (D4)", () => {
    const r = montarResumoCobranca(
      [obra("a")],
      [cobranca("a", { status: "cancelamento_agendado", acesso_ate: dia(8) })],
      trial,
      AGORA,
    );
    const l = r.linhas[0];
    expect(l.estado).toBe("cancelamento_agendado");
    expect(l.acoes.reativar).toBe(false);
    expect(l.acoes.reativarApos?.toISOString()).toBe(dia(8));
    expect(r.totalMensalCentavos).toBe(0);
  });

  it("cancelamento agendado com o período encerrado já permite reativar", () => {
    const r = montarResumoCobranca(
      [obra("a")],
      [cobranca("a", { status: "cancelamento_agendado", acesso_ate: dia(-1) })],
      trial,
      AGORA,
    );
    expect(r.linhas[0].acoes).toMatchObject({ reativar: true, reativarApos: null });
  });

  it("cancelada: pode reativar; reativada: vale a cobrança não cancelada", () => {
    const antiga = cobranca("a", { status: "cancelada", criado_em: dia(-60) });
    expect(montarResumoCobranca([obra("a")], [antiga], trial, AGORA).linhas[0].acoes.reativar).toBe(true);

    const nova = cobranca("a", { criado_em: dia(-1) });
    const r = montarResumoCobranca([obra("a")], [antiga, nova], trial, AGORA);
    expect(r.linhas[0].estado).toBe("ativa");
  });

  it("obra arquivada só aparece com período pago em andamento, sem ações", () => {
    const comPeriodo = montarResumoCobranca(
      [obra("a", { arquivada_em: dia(-1) })],
      [cobranca("a", { status: "cancelamento_agendado", acesso_ate: dia(9) })],
      trial,
      AGORA,
    );
    expect(comPeriodo.linhas).toHaveLength(1);
    expect(comPeriodo.linhas[0].arquivada).toBe(true);
    expect(comPeriodo.linhas[0].acoes).toEqual({
      contratar: false, cancelar: false, reativar: false, reativarApos: null,
    });

    const encerrada = montarResumoCobranca(
      [obra("a", { arquivada_em: dia(-30) })],
      [cobranca("a", { status: "cancelada" })],
      trial,
      AGORA,
    );
    expect(encerrada.linhas).toHaveLength(0);

    const semCobranca = montarResumoCobranca([obra("a", { arquivada_em: dia(-1) })], [], trial, AGORA);
    expect(semCobranca.linhas).toHaveLength(0);
  });

  it("conta ativa do modelo antigo: obra sem cobrança aparece como legado, sem contratar", () => {
    const r = montarResumoCobranca(
      [obra("a")],
      [],
      { status: "ativa", trial_fim: null, relatorios_enviados_trial: 0 },
      AGORA,
    );
    expect(r.linhas[0].legado).toBe(true);
    expect(r.linhas[0].acoes.contratar).toBe(false);
  });
});
