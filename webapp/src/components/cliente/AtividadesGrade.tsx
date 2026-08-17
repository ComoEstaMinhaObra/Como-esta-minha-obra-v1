"use client";

import { useState } from "react";
import { Lightbox } from "@/components/ui";
import { formatarDataBr } from "@/lib/datas";

export type AtividadeCard = {
  etapaNome: string;
  nota: string;
  fotosUrls: string[];
  status: "em_andamento" | "concluida";
  autor: string;
  dataIso: string;
};

export function AtividadesGrade({
  atividades,
}: {
  atividades: AtividadeCard[];
}) {
  const [ativa, setAtiva] = useState<AtividadeCard | null>(null);

  if (atividades.length === 0) {
    return (
      <p className="text-sm text-cinza-2">Nenhuma atividade neste relatório.</p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-2">
        {atividades.map((a) => (
          <li key={a.etapaNome}>
            <button
              type="button"
              onClick={() => setAtiva(a)}
              className="w-full overflow-hidden rounded-[18px] border border-borda bg-cartao text-left"
            >
              <div
                className="relative h-[94px] bg-cover bg-center bg-[#E4E4E0]"
                style={
                  a.fotosUrls[0]
                    ? { backgroundImage: `url(${a.fotosUrls[0]})` }
                    : undefined
                }
              >
                {a.fotosUrls.length > 1 ? (
                  <span className="absolute bottom-2 right-2 rounded-full bg-tinta/70 px-2 py-[3px] text-[9.5px] tracking-[0.08em] text-fundo">
                    {a.fotosUrls.length} fotos
                  </span>
                ) : null}
              </div>
              <div className="p-3 pb-3.5">
                <div className="flex items-center gap-[7px]">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${a.status === "concluida" ? "bg-tinta" : "bg-marca"}`}
                  />
                  <p className="line-clamp-2 text-[14px] font-normal text-tinta">
                    {a.etapaNome}
                  </p>
                </div>
                <p className="mt-1 text-[9.5px] tracking-[0.14em] uppercase text-cinza-2">
                  {a.status === "concluida" ? "Concluída" : "Em andamento"}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Lightbox
        aberto={!!ativa}
        onFechar={() => setAtiva(null)}
        titulo={ativa?.etapaNome}
        variante="atividade"
      >
        {ativa ? (
          <div className="space-y-4 text-white lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 lg:space-y-0">
            <div className="rounded-[14px] border border-white/15 bg-white/5 px-[18px] py-4">
              <p className="text-[10px] tracking-[0.16em] uppercase text-white/50">
                Descrição do engenheiro
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/90">
                {ativa.nota || "—"}
              </p>
              <p className="mt-2 text-xs text-white/50">
                {ativa.autor} · {formatarDataBr(ativa.dataIso.slice(0, 10))}
              </p>
            </div>
            <div className="space-y-3">
              {ativa.fotosUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt={ativa.etapaNome}
                  className="aspect-[4/3] w-full rounded-[14px] object-cover"
                />
              ))}
            </div>
          </div>
        ) : null}
      </Lightbox>
    </>
  );
}
