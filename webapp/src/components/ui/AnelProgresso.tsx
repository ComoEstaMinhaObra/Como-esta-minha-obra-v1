export function AnelProgresso({
  pct,
  tamanho = 120,
  espessura = 6,
  className = "",
}: {
  pct: number;
  tamanho?: number;
  espessura?: number;
  className?: string;
}) {
  const valor = Math.max(0, Math.min(100, pct));
  const r = (tamanho - espessura) / 2;
  const circunferencia = 2 * Math.PI * r;
  const offset = circunferencia * (1 - valor / 100);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: tamanho, height: tamanho }}
    >
      <svg width={tamanho} height={tamanho} className="-rotate-90">
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={espessura}
        />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke="#F25C1F"
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-serif text-2xl font-light tabular-nums">
        {valor}%
      </span>
    </div>
  );
}
