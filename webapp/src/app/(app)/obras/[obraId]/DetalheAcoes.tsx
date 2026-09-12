"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Botao } from "@/components/ui";
import type { RelatorioRascunho } from "@/lib/relatorios/tipos";
import { ModalCompartilhar } from "./ModalCompartilhar";
import { ModalRelatorio, type EtapaObra } from "./ModalRelatorio";

type RelatorioLista = {
  id: string;
  numero: number;
  status: "rascunho" | "enviado";
  dados_rascunho: RelatorioRascunho | null;
};

type LancamentoAnterior = {
  tipo: "medicao" | "material" | "aditivo";
  rotulo: string;
  valorCentavos: number;
  numero: number | null;
  relatorioId: string | null;
};

export function DetalheAcoes({
  obraId,
  obraNome,
  endereco,
  arquivada,
  etapas,
  proximoNumero,
  maxMedicao,
  maxAditivo,
  diasAditivadosPersistidos,
  terminoContratual,
  valorContratadoCentavos,
  pagoPersistidoCentavos,
  aditivosPersistidosCentavos,
  lancamentosAnteriores,
  climaDias,
  rascunhos,
  ultimoEnviado,
}: {
  obraId: string;
  obraNome: string;
  endereco: string;
  arquivada: boolean;
  etapas: EtapaObra[];
  proximoNumero: number;
  maxMedicao: number;
  maxAditivo: number;
  diasAditivadosPersistidos: number;
  terminoContratual: string;
  valorContratadoCentavos: number;
  pagoPersistidoCentavos: number;
  aditivosPersistidosCentavos: number;
  lancamentosAnteriores: LancamentoAnterior[];
  climaDias: {
    data: string;
    condicao: "aberto" | "nublado" | "chuvoso";
    prob_chuva: number | null;
  }[];
  rascunhos: RelatorioLista[];
  ultimoEnviado?: {
    id: string;
    numero: number;
    dados: RelatorioRascunho | null;
  } | null;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const retificarId = search.get("retificar");
  const retificando = Boolean(
    retificarId && ultimoEnviado?.id === retificarId && ultimoEnviado.dados,
  );
  const dadosRetificacao = retificando ? ultimoEnviado?.dados ?? null : null;
  const pagoRetificacao = dadosRetificacao
    ? dadosRetificacao.financeiro.medicoes.reduce(
        (total, item) => total + item.valorCentavos,
        0,
      ) +
      dadosRetificacao.financeiro.materiais.reduce(
        (total, item) => total + item.valorCentavos,
        0,
      ) -
      dadosRetificacao.financeiro.estornos
        .filter((item) => item.grupo !== "aditivos")
        .reduce((total, item) => total + Math.abs(item.valorCentavos), 0)
    : 0;
  const aditivoRetificacao = dadosRetificacao
    ? dadosRetificacao.financeiro.aditivos.reduce(
        (total, item) => total + item.valorCentavos,
        0,
      ) -
      dadosRetificacao.financeiro.estornos
        .filter((item) => item.grupo === "aditivos")
        .reduce((total, item) => total + Math.abs(item.valorCentavos), 0)
    : 0;
  const diasRetificacao = dadosRetificacao
    ? dadosRetificacao.prazo.reduce((total, item) => total + item.dias, 0)
    : 0;
  const anteriores = lancamentosAnteriores.filter(
    (l) => l.relatorioId !== retificarId,
  );
  const historicoFinanceiro = {
    medicoes: anteriores
      .filter((l) => l.tipo === "medicao")
      .map((l) => ({ rotulo: l.rotulo, valorCentavos: l.valorCentavos })),
    materiais: anteriores
      .filter((l) => l.tipo === "material")
      .map((l) => ({ rotulo: l.rotulo, valorCentavos: l.valorCentavos })),
    aditivos: anteriores
      .filter((l) => l.tipo === "aditivo")
      .map((l) => ({ rotulo: l.rotulo, valorCentavos: l.valorCentavos })),
  };
  const [compartilharAberto, setCompartilharAberto] = useState(
    () => search.get("compartilhar") === "1",
  );
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  const [editando, setEditando] = useState<RelatorioLista | null>(null);

  useEffect(() => {
    if (search.get("novoRelatorio") === "1" && !arquivada) {
      setEditando(null);
      setRelatorioAberto(true);
    }
    const editarId = search.get("editarRelatorio");
    if (editarId) {
      const r = rascunhos.find((x) => x.id === editarId);
      if (r) {
        setEditando(r);
        setRelatorioAberto(true);
      }
    }
    if (retificando && !arquivada) {
      setEditando(null);
      setRelatorioAberto(true);
    }
  }, [search, arquivada, rascunhos, retificando]);

  function fecharRelatorio() {
    setRelatorioAberto(false);
    setEditando(null);
    router.replace(`/obras/${obraId}`);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Link href={`/c/${obraId}`}>
          <Botao variante="secundario">Ver página do cliente</Botao>
        </Link>
        <Botao
          variante="secundario"
          onClick={() => setCompartilharAberto(true)}
          disabled={arquivada}
        >
          Compartilhar
        </Botao>
        <Botao
          variante="primario"
          onClick={() => {
            setEditando(null);
            setRelatorioAberto(true);
          }}
          disabled={arquivada}
        >
          Novo relatório
        </Botao>
      </div>

      <ModalCompartilhar
        obraId={obraId}
        aberto={compartilharAberto}
        onFechar={() => {
          setCompartilharAberto(false);
          if (search.get("compartilhar") === "1") {
            router.replace(`/obras/${obraId}`);
          }
        }}
      />

      <ModalRelatorio
        aberto={relatorioAberto}
        onFechar={fecharRelatorio}
        obraId={obraId}
        obraNome={obraNome}
        endereco={endereco}
        numero={
          retificando && ultimoEnviado
            ? ultimoEnviado.numero
            : (editando?.numero ?? proximoNumero)
        }
        relatorioId={
          editando?.id ?? (retificando ? (retificarId ?? undefined) : undefined)
        }
        retificando={retificando}
        etapas={etapas}
        rascunhoInicial={
          editando?.dados_rascunho ?? dadosRetificacao ?? undefined
        }
        maxMedicao={
          retificando
            ? Math.max(0, maxMedicao - (dadosRetificacao?.financeiro.medicoes.length ?? 0))
            : maxMedicao
        }
        maxAditivo={
          retificando
            ? Math.max(0, maxAditivo - (dadosRetificacao?.financeiro.aditivos.length ?? 0))
            : maxAditivo
        }
        diasAditivadosPersistidos={
          diasAditivadosPersistidos - diasRetificacao
        }
        terminoContratual={terminoContratual}
        valorContratadoCentavos={valorContratadoCentavos}
        pagoPersistidoCentavos={pagoPersistidoCentavos - pagoRetificacao}
        aditivosPersistidosCentavos={
          aditivosPersistidosCentavos - aditivoRetificacao
        }
        historicoFinanceiro={historicoFinanceiro}
        climaDias={climaDias}
      />
    </>
  );
}
