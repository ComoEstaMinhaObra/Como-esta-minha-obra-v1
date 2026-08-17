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
      <div className="space-y-8">
        {grupos.map((g) => (
          <section key={g.dataIso}>
            <div className="flex items-baseline gap-2.5">
              <h2 className="whitespace-nowrap text-[10.5px] tracking-[0.18em] uppercase text-tinta">
                {formatarDataBr(g.dataIso)}
              </h2>
              <span className="h-px flex-1 bg-divisor" />
              <span className="whitespace-nowrap text-[10.5px] text-cinza-3">
                {g.fotos.length} foto{g.fotos.length === 1 ? "" : "s"}
              </span>
            </div>
            <ul className="mt-3.5 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
              {g.fotos.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setAtiva(f)}
                    className="w-full text-left"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={f.url}
                      alt={f.etapaNome}
                      className="aspect-square w-full rounded-[14px] object-cover"
                    />
                    <p className="mt-[6px] truncate text-[10px] tracking-[0.1em] uppercase text-cinza-2">
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
        variante="midia"
      >
        {ativa ? (
          <div className="space-y-3 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ativa.url}
              alt={ativa.etapaNome}
              className="aspect-[4/3] w-full rounded-[14px] object-cover"
            />
            <p className="text-[10.5px] tracking-[0.16em] uppercase text-white/60">
              publicada em {formatarDataBr(ativa.publicadaEm.slice(0, 10))}
            </p>
          </div>
        ) : null}
      </Lightbox>
    </>
  );
}
