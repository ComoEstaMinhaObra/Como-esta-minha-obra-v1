"use client";

import { useState, useTransition } from "react";
import { Botao, CampoTexto, useToast } from "@/components/ui";
import { reaisTextoParaCentavos } from "@/lib/afiliados/formatar";
import { mensagemRpc } from "@/lib/rpc-erros";
import { salvarConfigAction } from "./actions";

/** Carência e saque mínimo. Valem para comissões e pedidos novos. */
export function ConfigAfiliados({
  carenciaDias,
  saqueMinimoCentavos,
}: {
  carenciaDias: number;
  saqueMinimoCentavos: number;
}) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [carencia, setCarencia] = useState(String(carenciaDias));
  const [minimo, setMinimo] = useState(
    (saqueMinimoCentavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
  );

  function salvar() {
    const dias = Number(carencia);
    const centavos = reaisTextoParaCentavos(minimo);
    if (!Number.isInteger(dias) || centavos === null) {
      toast(mensagemRpc("CONFIG_INVALIDA"));
      return;
    }
    start(async () => {
      const r = await salvarConfigAction(dias, centavos);
      toast(r.ok ? "Configuração salva." : mensagemRpc(r.erro));
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <CampoTexto
        rotulo="Carência da comissão (dias)"
        inputMode="numeric"
        value={carencia}
        onChange={(e) => setCarencia(e.target.value)}
        className="w-56"
      />
      <CampoTexto
        rotulo="Saque mínimo (R$)"
        inputMode="decimal"
        value={minimo}
        onChange={(e) => setMinimo(e.target.value)}
        className="w-44"
      />
      <Botao variante="secundario" onClick={salvar} disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Botao>
    </div>
  );
}
