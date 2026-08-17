"use client";

import { useMemo, useState } from "react";
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfMonth,
  format,
  getDay,
  parseISO,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Lightbox } from "@/components/ui";

type RelatorioDia = {
  id: string;
  numero: number;
  enviadoEm: string;
};

const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

export function LinhaDoTempoCalendario({
  inicioIso,
  fimIso,
  relatorios,
}: {
  inicioIso: string;
  fimIso: string;
  relatorios: RelatorioDia[];
}) {
  const porData = useMemo(() => {
    const map = new Map<string, RelatorioDia>();
    for (const r of relatorios) {
      const key = r.enviadoEm.slice(0, 10);
      // se vários no mesmo dia, mantém o de maior número
      const prev = map.get(key);
      if (!prev || r.numero > prev.numero) map.set(key, r);
    }
    return map;
  }, [relatorios]);

  const [pdf, setPdf] = useState<RelatorioDia | null>(null);

  const inicio = parseISO(inicioIso);
  const fim = parseISO(fimIso);
  const meses =
    inicio <= fim
      ? eachMonthOfInterval({
          start: startOfMonth(inicio),
          end: endOfMonth(fim),
        })
      : [];

  const hoje = format(new Date(), "yyyy-MM-dd");

  return (
    <>
      <div className="grid grid-cols-1 gap-y-[38px] md:grid-cols-2 md:gap-x-8">
        {meses.map((mesDate) => {
          const mesInicio = startOfMonth(mesDate);
          const mesFim = endOfMonth(mesDate);
          const dias = eachDayOfInterval({ start: mesInicio, end: mesFim });
          const offset = getDay(mesInicio); // 0=domingo
          const noMes = dias.filter((d) => {
            const iso = format(d, "yyyy-MM-dd");
            return iso >= inicioIso && iso <= fimIso;
          });
          const comRelatorio = noMes.filter((d) =>
            porData.has(format(d, "yyyy-MM-dd")),
          ).length;

          return (
            <section key={format(mesDate, "yyyy-MM")}>
              <div className="flex items-baseline gap-2.5">
                <h2 className="whitespace-nowrap text-[10.5px] tracking-[0.18em] uppercase text-tinta">
                  {format(mesDate, "MMMM yyyy", { locale: ptBR })}
                </h2>
                <span className="h-px flex-1 bg-divisor" />
                <span className="whitespace-nowrap text-[10.5px] text-cinza-3">
                  {comRelatorio} relatório{comRelatorio === 1 ? "" : "s"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-7 text-center text-[9px] tracking-[0.1em] text-cinza-3">
                {DIAS_SEMANA.map((d, i) => (
                  <div key={`${d}-${i}`}>{d}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-y-[6px]">
                {Array.from({ length: offset }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {dias.map((d) => {
                  const iso = format(d, "yyyy-MM-dd");
                  const foraPeriodo = iso < inicioIso || iso > fimIso;
                  const futuro = iso > hoje;
                  const rel = porData.get(iso);

                  if (foraPeriodo) {
                    return (
                      <div
                        key={iso}
                        className="h-9 w-9 rounded-full text-[12.5px] text-cinza-3/40"
                      />
                    );
                  }

                  if (rel) {
                    return (
                      <button
                        key={iso}
                        type="button"
                        onClick={() => setPdf(rel)}
                        aria-label={`Relatório nº ${rel.numero} em ${iso}`}
                        className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-marca text-[12.5px] font-normal text-white"
                      >
                        {format(d, "d")}
                      </button>
                    );
                  }

                  return (
                    <div
                      key={iso}
                      className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[12.5px] ${futuro ? "text-cinza-3" : "text-tinta"}`}
                    >
                      {format(d, "d")}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <Lightbox
        aberto={!!pdf}
        onFechar={() => setPdf(null)}
        titulo={pdf ? `Relatório nº ${pdf.numero}` : undefined}
        preencher
        variante="pdf"
      >
        {pdf ? (
          <iframe
            title={`PDF relatório ${pdf.numero}`}
            src={`/api/relatorios/${pdf.id}/pdf`}
            className="min-h-0 flex-1 w-full rounded-[14px] bg-white"
          />
        ) : null}
      </Lightbox>
    </>
  );
}
