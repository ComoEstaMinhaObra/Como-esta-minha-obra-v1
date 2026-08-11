"use client";

/** Gauge duplo: arco superior = avanço físico; arco inferior = % desembolso. */
export function GaugeDuplo({
  avancoPct,
  pagoPct,
  tamanho = 220,
}: {
  avancoPct: number;
  pagoPct: number;
  tamanho?: number;
}) {
  const stroke = 10;
  const r = (tamanho - stroke * 2) / 2;
  const cx = tamanho / 2;
  const cy = tamanho / 2;
  const circ = 2 * Math.PI * r;

  const avanco = Math.min(100, Math.max(0, avancoPct));
  const pago = Math.min(100, Math.max(0, pagoPct));

  // Arco superior: 180° da esquerda para a direita (start = π, sweep clockwise in SVG = negative)
  // Usamos dasharray no círculo completo com offset para meia-lua.
  const semi = circ / 2;
  const avancoLen = (avanco / 100) * semi;
  const pagoLen = (pago / 100) * semi;

  function pontoNoArco(
    pct: number,
    // superior: começa em 180° (esq) e vai até 0° (dir); inferior: 0° → 180°
    arco: "superior" | "inferior",
  ) {
    const angulo =
      arco === "superior"
        ? Math.PI - (pct / 100) * Math.PI
        : 0 + (pct / 100) * Math.PI;
    return {
      x: cx + r * Math.cos(angulo),
      y: cy - r * Math.sin(angulo),
    };
  }

  const marcadorAvanco = pontoNoArco(avanco, "superior");
  const marcadorPago = pontoNoArco(pago, "inferior");

  return (
    <div className="relative mx-auto" style={{ width: tamanho, height: tamanho }}>
      <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
        <defs>
          <linearGradient id="gaugeAmbar" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFB38A" />
            <stop offset="100%" stopColor="#F25C1F" />
          </linearGradient>
        </defs>

        {/* Trilhos */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#E4E4E0"
          strokeWidth={stroke}
          strokeDasharray={`${semi} ${semi}`}
          strokeDashoffset={0}
          transform={`rotate(-180 ${cx} ${cy})`}
          strokeLinecap="round"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="#E4E4E0"
          strokeWidth={stroke}
          strokeDasharray={`${semi} ${semi}`}
          strokeDashoffset={0}
          transform={`rotate(0 ${cx} ${cy})`}
          strokeLinecap="round"
        />

        {/* Avanço (superior) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#gaugeAmbar)"
          strokeWidth={stroke}
          strokeDasharray={`${avancoLen} ${circ}`}
          strokeDashoffset={0}
          transform={`rotate(-180 ${cx} ${cy})`}
          strokeLinecap="round"
        />

        {/* Desembolso (inferior, dir→esq visualmente: de 0° varrendo para 180°) */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="url(#gaugeAmbar)"
          strokeWidth={stroke}
          strokeDasharray={`${pagoLen} ${circ}`}
          strokeDashoffset={0}
          transform={`rotate(0 ${cx} ${cy})`}
          strokeLinecap="round"
        />

        <circle
          cx={marcadorAvanco.x}
          cy={marcadorAvanco.y}
          r={6}
          fill="#F25C1F"
          stroke="#fff"
          strokeWidth={2}
        />
        <circle
          cx={marcadorPago.x}
          cy={marcadorPago.y}
          r={6}
          fill="#F25C1F"
          stroke="#fff"
          strokeWidth={2}
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-serif text-[42px] font-light leading-none text-tinta">
          {avanco}
          <span className="text-2xl">%</span>
        </p>
        <p className="mt-1 text-[10px] tracking-[0.14em] uppercase text-cinza-2">
          avanço
        </p>
        <p className="mt-3 font-serif text-[28px] font-light leading-none text-tinta">
          {pago}
          <span className="text-lg">%</span>
        </p>
        <p className="mt-1 text-[10px] tracking-[0.14em] uppercase text-cinza-2">
          pago
        </p>
      </div>
    </div>
  );
}
