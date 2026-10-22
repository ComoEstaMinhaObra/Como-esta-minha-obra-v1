export type DuracaoDesconto = "primeira_fatura" | "permanente";

/** Basis points → "20%" / "12,5%". */
export function formatarBps(bps: number): string {
  const pct = bps / 100;
  return `${pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/** Texto do desconto do link: "20% de desconto na primeira fatura". */
export function descreverDesconto(
  bps: number,
  duracao: DuracaoDesconto | null,
): string | null {
  if (bps <= 0 || !duracao) return null;
  return duracao === "primeira_fatura"
    ? `${formatarBps(bps)} de desconto na primeira fatura`
    : `${formatarBps(bps)} de desconto em todas as faturas`;
}

/** Texto da comissão do link: "20% de todos os pagamentos" / "10% da primeira fatura". */
export function descreverComissao(bps: number, vitalicia: boolean): string {
  return vitalicia
    ? `${formatarBps(bps)} de todos os pagamentos`
    : `${formatarBps(bps)} da primeira fatura`;
}

/** "20" ou "12,5" (campo de formulário, em %) → basis points; `null` se inválido. */
export function percentualParaBps(texto: string): number | null {
  const limpo = texto.trim().replace("%", "").replace(",", ".");
  if (limpo === "" || !/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  const bps = Math.round(Number(limpo) * 100);
  return Number.isFinite(bps) ? bps : null;
}

/** Basis points → texto de campo ("20" ou "12,5"). */
export function bpsParaPercentual(bps: number): string {
  return (bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** "50", "50,00" ou "1.234,50" (campo em reais) → centavos; `null` se inválido. */
export function reaisTextoParaCentavos(texto: string): number | null {
  const limpo = texto.trim().replace(/^R\$\s*/, "").replace(/\./g, "").replace(",", ".");
  if (limpo === "" || !/^\d+(\.\d{1,2})?$/.test(limpo)) return null;
  return Math.round(Number(limpo) * 100);
}
