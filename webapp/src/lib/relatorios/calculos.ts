import type { LancamentoPersistido, RelatorioRascunho } from "@/lib/relatorios/tipos";

export function calcularAvancoGeral(
  etapas: { peso: number; pct: number }[],
): number {
  if (etapas.length === 0) return 0;
  const somaPesos = etapas.reduce((acc, e) => acc + e.peso, 0);
  if (somaPesos === 0) return 0;
  const soma = etapas.reduce((acc, e) => acc + e.peso * e.pct, 0);
  return Math.round(soma / somaPesos);
}

export function calcularFinanceiro(params: {
  valorContratadoCentavos: number;
  aditivosCentavos: number[];
  supressoesCentavos?: number[]; // valores positivos, subtraídos do contratado
  pagoCentavos: number[]; // sinal + medições + materiais + estornos (já com sinal)
  estornosAditivosCentavos?: number[]; // valores negativos, subtraídos do contratado
}) {
  const aditivosAcumulado =
    params.aditivosCentavos.reduce((a, b) => a + b, 0) +
    (params.estornosAditivosCentavos ?? []).reduce((a, b) => a + b, 0);
  const supressoesAcumulado = (params.supressoesCentavos ?? []).reduce(
    (a, b) => a + b,
    0,
  );
  const contratadoTotalCentavos =
    params.valorContratadoCentavos + aditivosAcumulado - supressoesAcumulado;
  const pagoAcumuladoCentavos = params.pagoCentavos.reduce((a, b) => a + b, 0);
  // Contratado inválido (≤ 0) é reportado por `validarInvariantesFinanceiras`;
  // aqui só evitamos divisão por zero no cálculo ao vivo do formulário.
  const pctPago = Math.round(
    (pagoAcumuladoCentavos / Math.max(contratadoTotalCentavos, 1)) * 100,
  );
  const saldoCentavos = contratadoTotalCentavos - pagoAcumuladoCentavos;
  return {
    aditivosAcumuladoCentavos: aditivosAcumulado,
    supressoesAcumuladoCentavos: supressoesAcumulado,
    contratadoTotalCentavos,
    pagoAcumuladoCentavos,
    pctPago,
    saldoCentavos,
  };
}

export type InvarianteFinanceira =
  | "CONTRATADO_INVALIDO"
  | "PAGO_NEGATIVO"
  | "PAGO_ACIMA_CONTRATADO";

/** Mesmas regras de `fn_preparar_envio_relatorio`, para feedback imediato. */
export function validarInvariantesFinanceiras(fin: {
  contratadoTotalCentavos: number;
  pagoAcumuladoCentavos: number;
}): InvarianteFinanceira | null {
  if (fin.contratadoTotalCentavos <= 0) return "CONTRATADO_INVALIDO";
  if (fin.pagoAcumuladoCentavos < 0) return "PAGO_NEGATIVO";
  if (fin.pagoAcumuladoCentavos > fin.contratadoTotalCentavos) {
    return "PAGO_ACIMA_CONTRATADO";
  }
  return null;
}

export type TipoLancamentoOrigem = "sinal" | "medicao" | "material" | "aditivo";

export interface SaldoEstornavel {
  id: string;
  tipo: TipoLancamentoOrigem;
  rotulo: string;
  valorCentavos: number;
  /** Total já estornado (positivo). */
  estornadoCentavos: number;
  saldoCentavos: number;
}

/** Grupo contábil do estorno, derivado do tipo da origem (espelha o SQL). */
export function grupoDoEstorno(
  tipoOrigem: TipoLancamentoOrigem,
): "medicoes" | "materiais" | "aditivos" {
  if (tipoOrigem === "aditivo") return "aditivos";
  if (tipoOrigem === "material") return "materiais";
  return "medicoes";
}

const TIPOS_ESTORNAVEIS: string[] = ["sinal", "medicao", "material", "aditivo"];

/** Saldo ainda estornável de cada lançamento de origem já persistido. */
export function calcularSaldoEstornavel(
  lancamentos: LancamentoPersistido[],
): SaldoEstornavel[] {
  return lancamentos
    .filter((l) => TIPOS_ESTORNAVEIS.includes(l.tipo))
    .map((origem) => {
      const estornadoCentavos = lancamentos
        .filter((l) => l.tipo === "estorno" && l.origemId === origem.id)
        .reduce((total, l) => total - l.valorCentavos, 0);
      return {
        id: origem.id,
        tipo: origem.tipo as TipoLancamentoOrigem,
        rotulo: origem.rotulo,
        valorCentavos: origem.valorCentavos,
        estornadoCentavos,
        saldoCentavos: origem.valorCentavos - estornadoCentavos,
      };
    });
}

/** Totais persistidos + o que o rascunho acrescenta (estado final do relatório). */
export function calcularFinanceiroProjetado(params: {
  valorContratadoCentavos: number;
  lancamentos: LancamentoPersistido[];
  financeiro: RelatorioRascunho["financeiro"];
}) {
  const { lancamentos, financeiro: rasc } = params;
  const tipoPorId = new Map(lancamentos.map((l) => [l.id, l.tipo]));
  const estornosNovos = rasc.estornos.map((e) => {
    const tipo = tipoPorId.get(e.origemId);
    return {
      grupo: TIPOS_ESTORNAVEIS.includes(tipo ?? "")
        ? grupoDoEstorno(tipo as TipoLancamentoOrigem)
        : "medicoes",
      valorCentavos: -Math.abs(e.valorCentavos),
    };
  });
  const persistidos = (tipo: string) =>
    lancamentos.filter((l) => l.tipo === tipo).map((l) => l.valorCentavos);

  return calcularFinanceiro({
    valorContratadoCentavos: params.valorContratadoCentavos,
    aditivosCentavos: [
      ...persistidos("aditivo"),
      ...rasc.aditivos.map((a) => a.valorCentavos),
    ],
    supressoesCentavos: [
      ...persistidos("supressao"),
      ...rasc.supressoes.map((x) => x.valorCentavos),
    ],
    pagoCentavos: [
      ...persistidos("sinal"),
      ...persistidos("medicao"),
      ...persistidos("material"),
      ...lancamentos
        .filter((l) => l.tipo === "estorno" && l.grupo !== "aditivos")
        .map((l) => l.valorCentavos),
      ...rasc.medicoes.map((m) => m.valorCentavos),
      ...rasc.materiais.map((m) => m.valorCentavos),
      ...estornosNovos
        .filter((e) => e.grupo !== "aditivos")
        .map((e) => e.valorCentavos),
    ],
    estornosAditivosCentavos: [
      ...lancamentos
        .filter((l) => l.tipo === "estorno" && l.grupo === "aditivos")
        .map((l) => l.valorCentavos),
      ...estornosNovos
        .filter((e) => e.grupo === "aditivos")
        .map((e) => e.valorCentavos),
    ],
  });
}

export type ProblemaFinanceiro =
  | InvarianteFinanceira
  | "VALOR_INVALIDO"
  | "DESCRICAO_OBRIGATORIA"
  | "ESTORNO_SEM_ORIGEM"
  | "ESTORNO_ACIMA_ORIGEM";

export const MENSAGENS_PROBLEMA_FINANCEIRO: Record<ProblemaFinanceiro, string> = {
  CONTRATADO_INVALIDO: "O valor contratado vigente precisa continuar maior que zero.",
  PAGO_NEGATIVO: "O total pago não pode ficar negativo.",
  PAGO_ACIMA_CONTRATADO:
    "O total pago não pode superar o valor contratado vigente. Registre a devolução ou o estorno da diferença.",
  VALOR_INVALIDO: "Todos os valores lançados precisam ser maiores que zero.",
  DESCRICAO_OBRIGATORIA: "Informe a descrição das supressões e dos estornos.",
  ESTORNO_SEM_ORIGEM: "Escolha o lançamento de origem de cada estorno.",
  ESTORNO_ACIMA_ORIGEM: "O estorno não pode superar o saldo do lançamento de origem.",
};

/** Regras do envio (1.4) espelhadas para feedback imediato no formulário. */
export function problemasFinanceiros(params: {
  valorContratadoCentavos: number;
  lancamentos: LancamentoPersistido[];
  financeiro: RelatorioRascunho["financeiro"];
}): ProblemaFinanceiro[] {
  const { financeiro: fin, lancamentos } = params;
  const problemas = new Set<ProblemaFinanceiro>();

  const valores = [
    ...fin.medicoes,
    ...fin.materiais,
    ...fin.aditivos,
    ...fin.supressoes,
    ...fin.estornos,
  ].map((item) => item.valorCentavos);
  if (valores.some((v) => !(v > 0))) problemas.add("VALOR_INVALIDO");

  if (
    [...fin.supressoes, ...fin.estornos].some(
      (item) => item.descricao.trim().length === 0,
    )
  ) {
    problemas.add("DESCRICAO_OBRIGATORIA");
  }

  const saldos = new Map(
    calcularSaldoEstornavel(lancamentos).map((s) => [s.id, s.saldoCentavos]),
  );
  const somaPorOrigem = new Map<string, number>();
  for (const e of fin.estornos) {
    if (!saldos.has(e.origemId)) {
      problemas.add("ESTORNO_SEM_ORIGEM");
      continue;
    }
    somaPorOrigem.set(
      e.origemId,
      (somaPorOrigem.get(e.origemId) ?? 0) + Math.abs(e.valorCentavos),
    );
  }
  for (const [origemId, soma] of somaPorOrigem) {
    if (soma > (saldos.get(origemId) ?? 0)) problemas.add("ESTORNO_ACIMA_ORIGEM");
  }

  const invariante = validarInvariantesFinanceiras(
    calcularFinanceiroProjetado(params),
  );
  if (invariante) problemas.add(invariante);

  return [...problemas];
}

export function proximoRotuloMedicao(
  maxPersistido: number,
  pendentesNoRascunho: number,
): string {
  const n = maxPersistido + pendentesNoRascunho + 1;
  return `Medição ${String(n).padStart(2, "0")}`;
}

export function proximoRotuloAditivo(
  maxPersistido: number,
  pendentesNoRascunho: number,
): string {
  const n = maxPersistido + pendentesNoRascunho + 1;
  return `Aditivo ${String(n).padStart(2, "0")}`;
}

export function proximoRotuloSupressao(
  maxPersistido: number,
  pendentesNoRascunho: number,
): string {
  const n = maxPersistido + pendentesNoRascunho + 1;
  return `Supressão ${String(n).padStart(2, "0")}`;
}

export function calcularNovaDataTermino(
  terminoContratualIso: string,
  diasAditivados: number[],
): string {
  const [y, m, d] = terminoContratualIso.split("-").map(Number);
  const data = new Date(Date.UTC(y, m - 1, d));
  const total = diasAditivados.reduce((a, b) => a + b, 0);
  data.setUTCDate(data.getUTCDate() + total);
  const yy = data.getUTCFullYear();
  const mm = String(data.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(data.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function pctMonotonicoValido(
  pctAtual: number,
  pctRascunho: number,
): boolean {
  return pctRascunho >= pctAtual && pctRascunho <= 100 && pctRascunho >= 0;
}
