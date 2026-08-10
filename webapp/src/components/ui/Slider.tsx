"use client";

export function Slider({
  valor,
  min = 0,
  max = 100,
  onChange,
  className = "",
  "aria-label": ariaLabel,
}: {
  valor: number;
  min?: number;
  max?: number;
  onChange: (valor: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  const travado = Math.max(min, Math.min(max, valor));

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={travado}
      aria-label={ariaLabel}
      onChange={(e) => {
        const next = Number(e.target.value);
        onChange(Math.max(min, next));
      }}
      className={`h-1 w-full cursor-pointer appearance-none rounded-full bg-divisor accent-marca ${className}`}
    />
  );
}
