"use client";

import { useTransition } from "react";
import { Botao, useToast } from "@/components/ui";
import { reprocessarWebhookAction } from "./actions";

export function ReprocessarWebhookBotao({ logId }: { logId: string }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();

  return (
    <Botao
      variante="secundario"
      className="!px-3 !py-1 text-xs"
      disabled={pending}
      aria-label="Reprocessar webhook"
      onClick={() => {
        start(async () => {
          const r = await reprocessarWebhookAction(logId);
          if (!r.ok) {
            toast(r.erro || "Falha ao reprocessar");
            return;
          }
          toast(r.mensagem || "Reprocessado");
        });
      }}
    >
      {pending ? "…" : "Reprocessar"}
    </Botao>
  );
}
