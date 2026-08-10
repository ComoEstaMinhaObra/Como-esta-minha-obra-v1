export function formatarBRL(centavos: number): string {
  return (centavos / 100)
    .toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })
    .replace(/\u00a0/g, " ");
}

/** Compacto do protótipo: < R$ 1.000 inteiro normal; >= 1.000 → mil; >= 1 mi → mi. */
export function formatarBRLCompacto(centavos: number): string {
  const reais = Math.abs(centavos) / 100;
  const sinal = centavos < 0 ? "-" : "";

  if (reais < 1000) {
    return `${sinal}${formatarBRL(Math.abs(centavos))}`;
  }

  if (reais < 1_000_000) {
    const mil = reais / 1000;
    const texto =
      mil % 1 === 0
        ? mil.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
        : mil.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
    return `${sinal}R$ ${texto} mil`;
  }

  const mi = reais / 1_000_000;
  const texto = mi.toLocaleString("pt-BR", {
    minimumFractionDigits: mi < 10 ? 2 : 2,
    maximumFractionDigits: 2,
  });
  return `${sinal}R$ ${texto} mi`;
}
