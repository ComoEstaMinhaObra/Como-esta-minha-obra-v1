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
      className={`inline-flex items-center justify-center rounded-full bg-escuro-2 text-white ${className}`}
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.32 }}
      aria-hidden
    >
      {iniciaisDe(nome)}
    </span>
  );
}
