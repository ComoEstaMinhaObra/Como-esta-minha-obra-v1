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
  pagoCentavos: number[]; // sinal + medições + materiais + estornos (já com sinal)
  estornosAditivosCentavos?: number[]; // valores negativos ou positivos a subtrair do contratado
}) {
  const aditivosAcumulado =
    params.aditivosCentavos.reduce((a, b) => a + b, 0) +
    (params.estornosAditivosCentavos ?? []).reduce((a, b) => a + b, 0);
  const contratadoTotalCentavos =
    params.valorContratadoCentavos + aditivosAcumulado;
  const pagoAcumuladoCentavos = params.pagoCentavos.reduce((a, b) => a + b, 0);
  const pctPago =
    contratadoTotalCentavos > 0
      ? Math.round((pagoAcumuladoCentavos / contratadoTotalCentavos) * 100)
      : 0;
  const saldoCentavos = contratadoTotalCentavos - pagoAcumuladoCentavos;
  return {
    aditivosAcumuladoCentavos: aditivosAcumulado,
    contratadoTotalCentavos,
    pagoAcumuladoCentavos,
    pctPago,
    saldoCentavos,
  };
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
