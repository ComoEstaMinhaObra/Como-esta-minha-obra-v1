"use client";

import { useState } from "react";
import { Lightbox } from "@/components/ui";

export function PdfOverlay({
  relatorioId,
  numero,
  dataLabel,
}: {
  relatorioId: string;
  numero: number;
  dataLabel: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="shrink-0 whitespace-nowrap rounded-full border border-white/25 px-3 py-[9px] text-[9.5px] tracking-[0.1em] uppercase text-white"
      >
        Abrir em PDF
      </button>
      <Lightbox
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={`Relatório nº ${numero}`}
        preencher
        variante="pdf"
      >
        <p className="mb-3 text-[10.5px] tracking-[0.16em] uppercase text-white/60">
          {dataLabel}
        </p>
        <iframe
          title={`PDF relatório ${numero}`}
          src={`/api/relatorios/${relatorioId}/pdf`}
          className="min-h-0 flex-1 w-full rounded-[14px] bg-white"
        />
      </Lightbox>
    </>
  );
}
