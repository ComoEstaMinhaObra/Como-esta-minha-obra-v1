"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Botao, ModalBase } from "@/components/ui";

export function ModalUpsellLimite({
  aberto,
  onFechar,
  titulo = "Limite do plano",
  mensagem = "Você atingiu o limite de obras do seu plano. Arquive uma obra ou assine um plano maior para continuar.",
}: {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  mensagem?: string;
}) {
  const router = useRouter();

  return (
    <ModalBase aberto={aberto} onFechar={onFechar} titulo={titulo}>
      <div className="space-y-4">
        <p className="text-sm text-cinza-2">{mensagem}</p>
        <div className="flex flex-wrap gap-2">
          <Botao variante="secundario" onClick={onFechar}>
            Fechar
          </Botao>
          <Botao
            onClick={() => {
              onFechar();
              router.push("/planos");
            }}
          >
            Ver planos
          </Botao>
        </div>
        <p className="text-xs text-cinza-3">
          Ou vá direto para{" "}
          <Link href="/planos" className="underline">
            /planos
          </Link>
          .
        </p>
      </div>
    </ModalBase>
  );
}
