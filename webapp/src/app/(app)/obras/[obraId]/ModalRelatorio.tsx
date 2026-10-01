"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Botao, RotuloSecao, Slider, useToast } from "@/components/ui";
import {
  calcularAvancoGeral,
  problemasFinanceiros,
  type SaldoEstornavel,
} from "@/lib/relatorios/calculos";
import type {
  LancamentoPersistido,
  RelatorioRascunho,
} from "@/lib/relatorios/tipos";
import { codigoRpc, mensagemRpc } from "@/lib/rpc-erros";
import { salvarRascunhoRelatorio } from "./relatorio-actions";
import { SecaoFinanceiro } from "./relatorio/SecaoFinanceiro";
import { SecaoPrazo } from "./relatorio/SecaoPrazo";
import { SecaoAtividades } from "./relatorio/SecaoAtividades";
import { SecaoClima } from "./relatorio/SecaoClima";

export type EtapaObra = {
  id: string;
  nome: string;
  peso: number;
  pct_atual: number;
};

type Props = {
  aberto: boolean;
  onFechar: () => void;
  obraId: string;
  obraNome: string;
  endereco: string;
  numero: number;
  relatorioId?: string;
  etapas: EtapaObra[];
  rascunhoInicial?: RelatorioRascunho;
  diasAditivadosPersistidos: number;
  terminoContratual: string;
  valorContratadoCentavos: number;
  lancamentos: LancamentoPersistido[];
  saldoEstornavel: SaldoEstornavel[];
  climaDias: {
    data: string;
    condicao: "aberto" | "nublado" | "chuvoso";
    prob_chuva: number | null;
  }[];
};

function rascunhoVazio(etapas: EtapaObra[]): RelatorioRascunho {
  return {
    versao: 1,
    etapas: etapas.map((e) => ({ etapaId: e.id, pct: e.pct_atual })),
    financeiro: {
      medicoes: [],
      materiais: [],
      aditivos: [],
      supressoes: [],
      estornos: [],
    },
    atividades: [],
    prazo: [],
  };
}

/** Rascunhos salvos antes das supressões/estornos vinculados não têm esses campos. */
function normalizarRascunho(r: RelatorioRascunho): RelatorioRascunho {
  return {
    ...r,
    financeiro: {
      ...r.financeiro,
      supressoes: r.financeiro.supressoes ?? [],
      estornos: (r.financeiro.estornos ?? []).filter((e) => e.origemId),
    },
  };
}

export function ModalRelatorio({
  aberto,
  onFechar,
  obraId,
  obraNome,
  endereco,
  numero,
  relatorioId: relatorioIdProp,
  etapas,
  rascunhoInicial,
  diasAditivadosPersistidos,
  terminoContratual,
  valorContratadoCentavos,
  lancamentos,
  saldoEstornavel,
  climaDias,
}: Props) {
  const { toast } = useToast();
  const [relatorioId, setRelatorioId] = useState(relatorioIdProp);
  const [dados, setDados] = useState<RelatorioRascunho>(
    () => normalizarRascunho(rascunhoInicial ?? rascunhoVazio(etapas)),
  );
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!aberto) return;
    setRelatorioId(relatorioIdProp);
    setDados(normalizarRascunho(rascunhoInicial ?? rascunhoVazio(etapas)));
  }, [aberto, etapas, rascunhoInicial, relatorioIdProp]);

  const geralAntes = useMemo(
    () =>
      calcularAvancoGeral(
        etapas.map((e) => ({ peso: e.peso, pct: e.pct_atual })),
      ),
    [etapas],
  );

  const geralDepois = useMemo(() => {
    const map = new Map(dados.etapas.map((e) => [e.etapaId, e.pct]));
    return calcularAvancoGeral(
      etapas.map((e) => ({
        peso: e.peso,
        pct: map.get(e.id) ?? e.pct_atual,
      })),
    );
  }, [dados.etapas, etapas]);

  const problemas = useMemo(
    () =>
      problemasFinanceiros({
        valorContratadoCentavos,
        lancamentos,
        financeiro: dados.financeiro,
      }),
    [valorContratadoCentavos, lancamentos, dados.financeiro],
  );

  if (!aberto) return null;

  const hoje = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Bahia",
  });

  function salvar() {
    startTransition(async () => {
      const r = await salvarRascunhoRelatorio({
        obraId,
        relatorioId,
        numero,
        dados,
      });
      if (!r.ok) {
        toast(mensagemRpc(codigoRpc({ message: r.erro })));
        return;
      }
      setRelatorioId(r.relatorioId);
      toast(`Rascunho do relatório nº ${r.numero} salvo`);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-fundo min-[800px]:bg-tinta/40 min-[800px]:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-fundo min-[800px]:mx-auto min-[800px]:max-w-3xl min-[800px]:rounded-[20px] min-[800px]:border min-[800px]:border-borda">
        <header className="flex items-start justify-between gap-3 border-b border-divisor px-5 py-4">
          <div>
            <p className="font-serif text-xl font-light">{obraNome}</p>
            <p className="text-sm text-cinza-2">
              Relatório nº {numero} · {hoje}
            </p>
            <p className="text-xs text-cinza-3">
              ao publicar, o cliente recebe por e-mail
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            className="text-cinza-2 text-xl"
            onClick={onFechar}
          >
            ×
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto px-5 py-6">
          <section className="space-y-3">
            <div className="flex items-end justify-between">
              <RotuloSecao>1 · Avanço físico</RotuloSecao>
              <p className="text-sm text-cinza-2">
                geral: {geralAntes}% → {geralDepois}%
              </p>
            </div>
            <ul className="space-y-3">
              {etapas.map((etapa) => {
                const atual =
                  dados.etapas.find((e) => e.etapaId === etapa.id)?.pct ??
                  etapa.pct_atual;
                const alterada = atual !== etapa.pct_atual;
                return (
                  <li key={etapa.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={alterada ? "text-marca" : ""}>
                        {etapa.nome}
                      </span>
                      <span
                        className={`tabular-nums ${alterada ? "text-marca" : "text-cinza-2"}`}
                      >
                        {atual}%
                      </span>
                    </div>
                    <Slider
                      valor={atual}
                      aria-label={etapa.nome}
                      onChange={(pct) =>
                        setDados((prev) => ({
                          ...prev,
                          etapas: prev.etapas.map((e) =>
                            e.etapaId === etapa.id
                              ? { ...e, pct: Math.max(pct, etapa.pct_atual) }
                              : e,
                          ),
                        }))
                      }
                    />
                  </li>
                );
              })}
            </ul>
          </section>

          <SecaoFinanceiro
            dados={dados}
            onChange={setDados}
            valorContratadoCentavos={valorContratadoCentavos}
            lancamentos={lancamentos}
            saldoEstornavel={saldoEstornavel}
          />

          <SecaoAtividades
            etapas={etapas}
            dados={dados}
            onChange={setDados}
            obraId={obraId}
            relatorioId={relatorioId}
          />

          <SecaoPrazo
            dados={dados}
            onChange={setDados}
            terminoContratual={terminoContratual}
            diasAditivadosPersistidos={diasAditivadosPersistidos}
          />

          <SecaoClima endereco={endereco} dias={climaDias} />
        </div>

        <footer className="space-y-2 border-t border-divisor px-5 py-4">
          <Botao
            variante="terciario"
            className="w-full"
            disabled={pending || problemas.length > 0}
            onClick={salvar}
          >
            {pending ? "Salvando…" : `Salvar rascunho do relatório nº ${numero}`}
          </Botao>
          <p className="text-center text-xs text-cinza-3">
            {problemas.length > 0
              ? "Corrija os avisos do financeiro para salvar."
              : "Nada é enviado ainda. O cliente só vê após você publicar."}
          </p>
        </footer>
      </div>
    </div>
  );
}
