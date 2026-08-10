"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BarraProgresso,
  Cartao,
  Selo,
} from "@/components/ui";
import { statusObraDeAvanco } from "@/lib/obras/etapas";

export type ObraCard = {
  id: string;
  nome: string;
  clienteNome: string;
  fotoCapaUrl: string | null;
  avanco: number;
  etapasConcluidas: number;
  totalEtapas: number;
  relatoriosEnviados: number;
  arquivada: boolean;
};

export function DashboardObras({ obras }: { obras: ObraCard[] }) {
  const [busca, setBusca] = useState("");
  const [verArquivadas, setVerArquivadas] = useState(false);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return obras.filter((o) => {
      if (verArquivadas ? !o.arquivada : o.arquivada) return false;
      if (!q) return true;
      return (
        o.nome.toLowerCase().includes(q) ||
        o.clienteNome.toLowerCase().includes(q)
      );
    });
  }, [obras, busca, verArquivadas]);

  const n = filtradas.length;
  const titulo =
    n === 1 ? "1 obra" : `${n} obras`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 min-[800px]:flex-row min-[800px]:items-center">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por obra ou cliente"
          className="w-full flex-1 rounded-full border border-borda bg-white px-4 py-2.5 text-sm outline-none focus:border-marca"
          aria-label="Buscar obras"
        />
        <Link
          href="/obras/nova"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-tinta px-5 py-2.5 text-sm text-white hover:bg-escuro-1"
        >
          + Nova obra
        </Link>
      </div>

      <div className="flex items-end justify-between gap-3">
        <h1 className="font-serif text-3xl font-light">{titulo}</h1>
        <button
          type="button"
          className="text-xs text-cinza-2 underline"
          onClick={() => setVerArquivadas((v) => !v)}
        >
          {verArquivadas ? "ver ativas" : "ver arquivadas"}
        </button>
      </div>

      {filtradas.length === 0 ? (
        <p className="text-sm text-cinza-2">
          Nenhuma obra encontrada. Crie a primeira em Nova obra.
        </p>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(270px,1fr))]">
          {filtradas.map((obra) => {
            const status = obra.arquivada
              ? { rotulo: "Arquivada" as const, tom: "cinza" as const }
              : statusObraDeAvanco(obra.avanco);
            return (
              <Link key={obra.id} href={`/obras/${obra.id}`}>
                <Cartao className="overflow-hidden transition-colors hover:border-marca/40">
                  <div className="aspect-[16/10] bg-divisor">
                    {obra.fotoCapaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={obra.fotoCapaUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="space-y-2 p-4">
                    <Selo tom={status.tom}>{status.rotulo}</Selo>
                    <h2 className="font-serif text-lg font-light leading-snug">
                      {obra.nome}
                    </h2>
                    <p className="text-sm text-cinza-2">{obra.clienteNome}</p>
                    <BarraProgresso pct={obra.avanco} />
                    <div className="flex justify-between text-xs text-cinza-2">
                      <span>{obra.avanco}%</span>
                      <span>
                        {obra.etapasConcluidas} de {obra.totalEtapas} etapas
                      </span>
                    </div>
                    <p className="text-xs text-cinza-3">
                      {obra.relatoriosEnviados === 0
                        ? "sem relatórios"
                        : `${obra.relatoriosEnviados} relatório${obra.relatoriosEnviados === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </Cartao>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
