"use client";

import { Botao, useToast } from "@/components/ui";

/** Copia um texto (link, chave Pix) para a área de transferência. */
export function CopiarBotao({
  texto,
  rotulo = "Copiar",
  aviso = "Copiado",
}: {
  texto: string;
  rotulo?: string;
  aviso?: string;
}) {
  const { toast } = useToast();
  return (
    <Botao
      variante="secundario"
      className="!px-3 !py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          toast(aviso);
        } catch {
          toast("Não foi possível copiar. Selecione e copie manualmente.");
        }
      }}
    >
      {rotulo}
    </Botao>
  );
}
