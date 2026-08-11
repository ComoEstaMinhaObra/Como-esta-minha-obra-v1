"use client";

import { useState } from "react";
import { Lightbox } from "@/components/ui";
import { formatarDataBr } from "@/lib/datas";

export type FotoGaleria = {
  id: string;
  url: string;
  etapaNome: string;
  publicadaEm: string;
};

export type GrupoGaleria = {
  dataIso: string;
  fotos: FotoGaleria[];
};

export function GaleriaCliente({ grupos }: { grupos: GrupoGaleria[] }) {
  const [ativa, setAtiva] = useState<FotoGaleria | null>(null);

  if (grupos.length === 0) {
    return (
      <p className="text-sm text-cinza-2">
        Ainda não há fotos publicadas nesta obra.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {grupos.map((g) => (
          <section key={g.dataIso}>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-medium text-tinta">
                {formatarDataBr(g.dataIso)}
              </h2>
              <span className="text-xs text-cinza-2">
                {g.fotos.length} foto{g.fotos.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {g.fotos.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setAtiva(f)}
                    className="w-full overflow-hidden rounded-[14px] border border-borda text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt={f.etapaNome}
                      className="aspect-square w-full object-cover"
                    />
                    <p className="truncate px-2 py-1.5 text-[10px] text-cinza-2">
                      {f.etapaNome}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <Lightbox
        aberto={!!ativa}
        onFechar={() => setAtiva(null)}
        titulo={ativa?.etapaNome}
      >
        {ativa ? (
          <div className="space-y-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ativa.url}
              alt={ativa.etapaNome}
              className="w-full rounded-lg"
            />
            <p className="text-sm text-white/70">
              publicada em {formatarDataBr(ativa.publicadaEm.slice(0, 10))}
            </p>
          </div>
        ) : null}
      </Lightbox>
    </>
  );
}
