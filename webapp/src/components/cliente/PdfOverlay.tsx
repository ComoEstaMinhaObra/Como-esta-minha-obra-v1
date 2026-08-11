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
        className="rounded-full bg-marca px-4 py-2 text-sm text-white"
      >
        Abrir em PDF
      </button>
      <Lightbox
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={`Relatório nº ${numero}`}
      >
        <p className="mb-3 text-sm text-white/70">{dataLabel}</p>
        <iframe
          title={`PDF relatório ${numero}`}
          src={`/api/relatorios/${relatorioId}/pdf`}
          className="h-[70vh] w-full rounded-lg bg-white"
        />
      </Lightbox>
    </>
  );
}
