"use client";

import { useState, useTransition } from "react";
import { Botao, CampoTexto, ModalBase, useToast } from "@/components/ui";
import { mensagemRpc } from "@/lib/rpc-erros";

type Resultado = { ok: true } | { ok: false; erro: string };

/** Botão que abre um modal pedindo um texto (motivo ou referência) antes de confirmar a ação. */
export function ConfirmarComTexto({
  rotuloBotao,
  titulo,
  descricao,
  rotuloCampo,
  obrigatorio,
  rotuloConfirmar,
  avisoSucesso,
  variante = "secundario",
  onConfirmar,
}: {
  rotuloBotao: string;
  titulo: string;
  descricao: string;
  rotuloCampo: string;
  obrigatorio: boolean;
  rotuloConfirmar: string;
  avisoSucesso: string;
  variante?: "primario" | "secundario";
  onConfirmar: (texto: string) => Promise<Resultado>;
}) {
  const { toast } = useToast();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [pending, start] = useTransition();

  function confirmar() {
    if (obrigatorio && !texto.trim()) {
      toast(mensagemRpc("MOTIVO_OBRIGATORIO"));
      return;
    }
    start(async () => {
      const r = await onConfirmar(texto);
      if (!r.ok) {
        toast(mensagemRpc(r.erro));
        return;
      }
      toast(avisoSucesso);
      setAberto(false);
      setTexto("");
    });
  }

  return (
    <>
      <Botao
        variante={variante}
        className="!px-3 !py-1 text-xs"
        onClick={() => setAberto(true)}
      >
        {rotuloBotao}
      </Botao>
      <ModalBase aberto={aberto} onFechar={() => setAberto(false)} titulo={titulo}>
        <div className="space-y-4">
          <p className="text-sm text-cinza-2">{descricao}</p>
          <CampoTexto
            rotulo={rotuloCampo}
            value={texto}
            maxLength={300}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={pending}>
              Voltar
            </Botao>
            <Botao onClick={confirmar} disabled={pending}>
              {pending ? "Aguarde…" : rotuloConfirmar}
            </Botao>
          </div>
        </div>
      </ModalBase>
    </>
  );
}
