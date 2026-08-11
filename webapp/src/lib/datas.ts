import { differenceInCalendarDays, parseISO } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

export const FUSO_BAHIA = "America/Bahia";

/** Data civil YYYY-MM-DD no fuso America/Bahia. */
export function hojeIsoBahia(agora: Date = new Date()): string {
  return formatInTimeZone(agora, FUSO_BAHIA, "yyyy-MM-dd");
}

export function formatarDataBr(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

export function formatarDataCurta(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${d}/${m}`;
}

/** Dias corridos desde início até hoje (Bahia), inclusive do dia inicial. */
export function diasDeObra(
  inicioContratualIso: string,
  hojeIso: string = hojeIsoBahia(),
): number {
  const inicio = parseISO(inicioContratualIso);
  const hoje = parseISO(hojeIso);
  return Math.max(0, differenceInCalendarDays(hoje, inicio) + 1);
}

/** Dias restantes até a entrega prevista (Bahia). Negativo se atrasado. */
export function diasRestantes(
  entregaPrevistaIso: string,
  hojeIso: string = hojeIsoBahia(),
): number {
  const entrega = parseISO(entregaPrevistaIso);
  const hoje = parseISO(hojeIso);
  return differenceInCalendarDays(entrega, hoje);
}

export function primeiroNome(nomeCompleto: string): string {
  const parte = nomeCompleto.trim().split(/\s+/).filter(Boolean)[0];
  return parte ?? "olá";
}

/** Mascara CPF: •••.XXX.XXX-•• (mostra dígitos 4–9). */
export function mascararCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length < 9) return "•••.•••.•••-••";
  const meio = digits.slice(3, 9);
  return `•••.${meio.slice(0, 3)}.${meio.slice(3, 6)}-••`;
}

export function dataZonedBahia(date: Date = new Date()): Date {
  return toZonedTime(date, FUSO_BAHIA);
}
