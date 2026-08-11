"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Botao } from "@/components/ui";
import { ModalCompartilhar } from "./ModalCompartilhar";

export function DetalheAcoes({
  obraId,
  arquivada,
}: {
  obraId: string;
  arquivada: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const [compartilharAberto, setCompartilharAberto] = useState(
    () => search.get("compartilhar") === "1",
  );

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
          onClick={() => router.push(`/obras/${obraId}?novoRelatorio=1`)}
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
    </>
  );
}
