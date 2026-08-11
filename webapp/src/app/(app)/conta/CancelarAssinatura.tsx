"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { cancelarAssinaturaConta } from "./actions";

export function CancelarAssinatura() {
  const [confirmando, setConfirmando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirmando) {
    return (
      <div className="space-y-2 border-t border-divisor pt-6">
        <h2 className="font-serif text-xl font-light">Assinatura</h2>
        <p className="text-sm text-cinza-2">
          Ao cancelar, a conta passa a somente leitura. Você continua vendo
          obras e PDFs, mas não cria nem envia relatórios.
        </p>
        <Botao variante="secundario" onClick={() => setConfirmando(true)}>
          Cancelar assinatura
        </Botao>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[16px] border border-marca/30 bg-marca/5 p-4">
      <p className="text-sm">
        Confirma o cancelamento? Esta ação encerra as cobranças futuras. O
        acesso fica em modo somente leitura.
      </p>
      {msg && <p className="text-sm text-marca">{msg}</p>}
      <div className="flex flex-wrap gap-2">
        <Botao
          variante="secundario"
          disabled={pending}
          onClick={() => {
            setConfirmando(false);
            setMsg(null);
          }}
        >
          Manter assinatura
        </Botao>
        <Botao
          variante="primario"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const r = await cancelarAssinaturaConta();
              if (!r.ok) {
                setMsg(`Não foi possível cancelar (${r.erro}).`);
                return;
              }
              setMsg("Assinatura cancelada.");
              setConfirmando(false);
            });
          }}
        >
          Confirmar cancelamento
        </Botao>
      </div>
    </div>
  );
}
