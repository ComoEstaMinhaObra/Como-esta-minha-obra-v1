function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function Avatar({
  nome,
  tamanho = 36,
  className = "",
}: {
  nome: string;
  tamanho?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[#D9D9D4] bg-transparent text-cinza-2 ${className}`}
      style={{
        width: tamanho,
        minWidth: tamanho,
        maxWidth: tamanho,
        height: tamanho,
        minHeight: tamanho,
        maxHeight: tamanho,
        fontSize: tamanho * 0.31,
        letterSpacing: "0.06em",
      }}
      aria-hidden
    >
      {iniciaisDe(nome)}
    </span>
  );
}
