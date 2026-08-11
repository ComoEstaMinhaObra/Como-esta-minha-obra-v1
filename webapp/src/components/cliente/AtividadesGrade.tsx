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

export function AtividadesGrade({ atividades }: { atividades: AtividadeCard[] }) {
  const [ativa, setAtiva] = useState<AtividadeCard | null>(null);

  if (atividades.length === 0) {
    return (
      <p className="text-sm text-cinza-2">Nenhuma atividade neste relatório.</p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3">
        {atividades.map((a) => (
          <li key={a.etapaNome}>
            <button
              type="button"
              onClick={() => setAtiva(a)}
              className="w-full overflow-hidden rounded-[16px] border border-borda bg-cartao text-left"
            >
              <div
                className="aspect-[4/3] bg-cover bg-center bg-[#E4E4E0]"
                style={
                  a.fotosUrls[0]
                    ? { backgroundImage: `url(${a.fotosUrls[0]})` }
                    : undefined
                }
              />
              <div className="space-y-1 p-2.5">
                <p className="line-clamp-2 text-xs font-medium text-tinta">
                  {a.etapaNome}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-cinza-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      a.status === "concluida" ? "bg-tinta" : "bg-marca"
                    }`}
                  />
                  {a.status === "concluida" ? "Concluída" : "Em andamento"}
                  {a.fotosUrls.length > 0 ? (
                    <span>· {a.fotosUrls.length} foto{a.fotosUrls.length > 1 ? "s" : ""}</span>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        ))}
      </ul>

      <Lightbox
        aberto={!!ativa}
        onFechar={() => setAtiva(null)}
        titulo={ativa?.etapaNome}
      >
        {ativa ? (
          <div className="space-y-4 text-white">
            <div>
              <p className="text-[10px] tracking-[0.16em] uppercase text-white/50">
                Descrição do engenheiro
              </p>
              <p className="mt-1 text-sm leading-relaxed">{ativa.nota || "—"}</p>
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
                  className="w-full rounded-lg"
                />
              ))}
            </div>
          </div>
        ) : null}
      </Lightbox>
    </>
  );
}
