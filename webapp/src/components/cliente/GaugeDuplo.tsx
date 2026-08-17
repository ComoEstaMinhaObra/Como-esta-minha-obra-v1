"use client";

/** Arcos independentes: avanço no hemisfério superior e desembolso no inferior. */
export function GaugeDuplo({
  avancoPct,
  pagoPct,
  tamanho = 250,
}: {
  avancoPct: number;
  pagoPct: number;
  tamanho?: number;
}) {
  const escala = tamanho / 250;
  const avanco = Math.min(100, Math.max(0, avancoPct));
  const pago = Math.min(100, Math.max(0, pagoPct));
  const r = 102;
  const cx = 125;
  const meiaCorda = 101.8;
  const flecha = Math.sqrt(r ** 2 - meiaCorda ** 2);
  const ajuste = Math.acos(meiaCorda / r);
  const abertura = Math.PI - ajuste * 2;

  function pontoNoArco(pct: number, arco: "superior" | "inferior") {
    const angulo =
      arco === "superior"
        ? -Math.PI + ajuste + (pct / 100) * abertura
        : Math.PI - ajuste - (pct / 100) * abertura;
    const cy = arco === "superior" ? 117.9 + flecha : 132.1 - flecha;
    return { x: cx + r * Math.cos(angulo), y: cy + r * Math.sin(angulo) };
  }

  const marcadorAvanco = pontoNoArco(avanco, "superior");
  const marcadorPago = pontoNoArco(pago, "inferior");

  return (
    <div
      className="relative mx-auto"
      style={{ width: tamanho, height: tamanho }}
    >
      <svg
        width={tamanho}
        height={tamanho}
        viewBox="0 0 250 250"
        className="block"
      >
        <defs>
          <linearGradient id="gaugeAmbar" x1="0" y1="1" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFB38A" />
            <stop offset="100%" stopColor="#F25C1F" />
          </linearGradient>
        </defs>
        <path
          d="M23.2 117.9 A102 102 0 0 1 226.8 117.9"
          fill="none"
          stroke="#ECECE9"
          strokeWidth="3"
          pathLength="100"
        />
        <path
          d="M23.2 132.1 A102 102 0 0 0 226.8 132.1"
          fill="none"
          stroke="#ECECE9"
          strokeWidth="3"
          pathLength="100"
        />
        <path
          d="M23.2 117.9 A102 102 0 0 1 226.8 117.9"
          fill="none"
          stroke="url(#gaugeAmbar)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${avanco} 100`}
        />
        <path
          d="M23.2 132.1 A102 102 0 0 0 226.8 132.1"
          fill="none"
          stroke="url(#gaugeAmbar)"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${pago} 100`}
        />
        <circle
          cx={marcadorAvanco.x}
          cy={marcadorAvanco.y}
          r="5.5"
          fill="#FAFAF9"
          stroke="#F25C1F"
          strokeWidth="1.5"
        />
        <circle
          cx={marcadorPago.x}
          cy={marcadorPago.y}
          r="5.5"
          fill="#FAFAF9"
          stroke="#F25C1F"
          strokeWidth="1.5"
        />
      </svg>
      <div
        className="pointer-events-none absolute inset-x-0 text-center"
        style={{ top: 52 * escala }}
      >
        <p
          className="font-serif font-light leading-[0.9] tracking-[-0.02em] text-tinta"
          style={{ fontSize: 52 * escala }}
        >
          {avanco}
          <span className="text-cinza-3" style={{ fontSize: 26 * escala }}>
            %
          </span>
        </p>
        <p
          className="mt-2 tracking-[0.22em] uppercase text-cinza-2"
          style={{ fontSize: 9.5 * escala }}
        >
          avanço físico
        </p>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 text-center"
        style={{ bottom: 52 * escala }}
      >
        <p
          className="font-serif font-light leading-[0.9] tracking-[-0.02em] text-tinta"
          style={{ fontSize: 52 * escala }}
        >
          {pago}
          <span className="text-cinza-3" style={{ fontSize: 26 * escala }}>
            %
          </span>
        </p>
        <p
          className="mt-2 tracking-[0.22em] uppercase text-cinza-2"
          style={{ fontSize: 9.5 * escala }}
        >
          desembolso
        </p>
      </div>
    </div>
  );
}
