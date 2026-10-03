"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Botao, ModalBase } from "@/components/ui";

/** Aviso de que a ação depende da cobrança da obra (substitui o antigo "limite do plano"). */
export function ModalCobrancaNecessaria({
  aberto,
  onFechar,
  titulo = "Cobrança necessária",
  mensagem = "Esta obra está somente leitura. Contrate a cobrança da obra para continuar.",
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
              router.push("/cobranca");
            }}
          >
            Ver cobrança
          </Botao>
        </div>
        <p className="text-xs text-cinza-3">
          Ou vá direto para{" "}
          <Link href="/cobranca" className="underline">
            Cobrança
          </Link>
          .
        </p>
      </div>
    </ModalBase>
  );
}
