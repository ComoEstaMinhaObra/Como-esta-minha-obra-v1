"use client";

import { useTransition } from "react";
import { Botao, useToast } from "@/components/ui";
import { reenviarConvitesProprietario } from "../actions";

export function ReenviarConvitesBotao({ userId }: { userId: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  return (
    <Botao
      variante="secundario"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await reenviarConvitesProprietario(userId);
          if (!r.ok) {
            toast("Não foi possível reenviar");
            return;
          }
          toast(
            r.enviados === 0
              ? "Nenhum convite pendente"
              : `${r.enviados} convite(s) reenviado(s)`,
          );
        });
      }}
    >
      {pending ? "Enviando…" : "Reenviar convites de proprietário"}
    </Botao>
  );
}
