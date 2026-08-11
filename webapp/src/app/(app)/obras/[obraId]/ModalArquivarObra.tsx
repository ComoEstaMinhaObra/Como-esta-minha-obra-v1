"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, CampoTexto, ModalBase, useToast } from "@/components/ui";
import { arquivarObraAction } from "./arquivar-actions";

export function ModalArquivarObra({
  obraId,
  nomeObra,
}: {
  obraId: string;
  nomeObra: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function confirmar() {
    setCarregando(true);
    try {
      const result = await arquivarObraAction(obraId, confirmacao);
      if (!result.ok) {
        if (result.erro === "NOME_NAO_CONFERE") {
          toast("Digite o nome da obra exatamente como aparece");
          return;
        }
        toast(result.erro);
        return;
      }
      toast("Página de acompanhamento arquivada");
      setAberto(false);
      router.push("/obras");
      router.refresh();
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="text-xs text-cinza-2 underline hover:text-marca"
        onClick={() => setAberto(true)}
      >
        Excluir página de acompanhamento
      </button>

      <ModalBase
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Excluir página de acompanhamento"
      >
        <div className="space-y-4">
          <p className="text-sm text-cinza-2">
            Os dados serão mantidos por 30 dias e depois removidos
            definitivamente. Para confirmar, digite o nome da obra:
          </p>
          <p className="font-serif text-base font-light">{nomeObra}</p>
          <CampoTexto
            rotulo="Nome da obra"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            placeholder={nomeObra}
          />
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={() => setAberto(false)}>
              Cancelar
            </Botao>
            <Botao
              variante="terciario"
              disabled={carregando || confirmacao.trim() !== nomeObra}
              onClick={confirmar}
            >
              {carregando ? "Arquivando…" : "Arquivar definitivamente"}
            </Botao>
          </div>
        </div>
      </ModalBase>
    </>
  );
}
