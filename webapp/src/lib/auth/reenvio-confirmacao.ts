/** Intervalo mínimo entre dois envios do link de confirmação. */
export const SEGUNDOS_ESPERA_REENVIO = 60;

/** Segundos que faltam até `liberadoEm` (epoch ms); 0 quando já liberou. */
export function segundosRestantes(liberadoEm: number, agora: number): number {
  return Math.max(0, Math.ceil((liberadoEm - agora) / 1000));
}

export function rotuloReenvio(restantes: number, enviando: boolean): string {
  if (enviando) return "Enviando…";
  if (restantes > 0) return `Reenviar e-mail em ${restantes}s`;
  return "Reenviar e-mail";
}
