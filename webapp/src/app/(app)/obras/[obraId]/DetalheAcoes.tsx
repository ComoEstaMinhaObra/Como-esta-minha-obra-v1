"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Botao } from "@/components/ui";

export function DetalheAcoes({
  obraId,
  arquivada,
}: {
  obraId: string;
  arquivada: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();

  return (
    <div className="flex flex-wrap gap-2">
      <Link href={`/c/${obraId}`}>
        <Botao variante="secundario">Ver página do cliente</Botao>
      </Link>
      <Botao
        variante="secundario"
        onClick={() => router.push(`/obras/${obraId}?compartilhar=1`)}
        disabled={arquivada}
      >
        Compartilhar
      </Botao>
      <Botao
        variante="primario"
        onClick={() => router.push(`/obras/${obraId}?novoRelatorio=1`)}
        disabled={arquivada || search.get("novoRelatorio") === "1"}
      >
        Novo relatório
      </Botao>
    </div>
  );
}
