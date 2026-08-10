export function BarraProgresso({
  pct,
  className = "",
}: {
  pct: number;
  className?: string;
}) {
  const valor = Math.max(0, Math.min(100, pct));
  const cor = valor >= 100 ? "bg-tinta" : "bg-marca";

  return (
    <div
      className={`h-[2px] w-full overflow-hidden rounded-full bg-divisor ${className}`}
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-[width] ${cor}`}
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}
