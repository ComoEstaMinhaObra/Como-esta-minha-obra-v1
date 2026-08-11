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
  climaDias,
  rascunhos,
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
  climaDias: {
    data: string;
    condicao: "aberto" | "nublado" | "chuvoso";
    prob_chuva: number | null;
  }[];
  rascunhos: RelatorioLista[];
}) {
  const router = useRouter();
  const search = useSearchParams();
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
  }, [search, arquivada, rascunhos]);

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
        numero={editando?.numero ?? proximoNumero}
        relatorioId={editando?.id}
        etapas={etapas}
        rascunhoInicial={editando?.dados_rascunho ?? undefined}
        maxMedicao={maxMedicao}
        maxAditivo={maxAditivo}
        diasAditivadosPersistidos={diasAditivadosPersistidos}
        terminoContratual={terminoContratual}
        valorContratadoCentavos={valorContratadoCentavos}
        pagoPersistidoCentavos={pagoPersistidoCentavos}
        aditivosPersistidosCentavos={aditivosPersistidosCentavos}
        climaDias={climaDias}
      />
    </>
  );
}
