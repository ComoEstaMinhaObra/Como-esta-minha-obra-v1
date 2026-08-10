"use client";

import { useId, useState } from "react";

function formatarExibicao(centavos: number): string {
  const reais = centavos / 100;
  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseCentavos(texto: string): number {
  const digits = texto.replace(/\D/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10);
}

export function CampoMoeda({
  rotulo,
  valorCentavos,
  onChangeCentavos,
  className = "",
  id,
}: {
  rotulo: string;
  valorCentavos: number;
  onChangeCentavos: (centavos: number) => void;
  className?: string;
  id?: string;
}) {
  const autoId = useId();
  const campoId = id ?? autoId;
  const [texto, setTexto] = useState(formatarExibicao(valorCentavos));

  return (
    <label className={`flex flex-col gap-1.5 ${className}`} htmlFor={campoId}>
      <span className="text-sm text-cinza-2">{rotulo}</span>
      <div className="flex items-center gap-2 rounded-full border border-borda bg-white px-4 py-2.5 focus-within:border-marca">
        <span className="text-sm text-cinza-2">R$</span>
        <input
          id={campoId}
          inputMode="numeric"
          className="w-full bg-transparent text-sm text-tinta outline-none"
          value={texto}
          onChange={(e) => {
            const centavos = parseCentavos(e.target.value);
            setTexto(formatarExibicao(centavos));
            onChangeCentavos(centavos);
          }}
        />
      </div>
    </label>
  );
}
