"use client";

import { CopiarBotao } from "@/components/afiliados/CopiarBotao";
import { ConfirmarComTexto } from "../ConfirmarComTexto";
import { pagarSaqueAction, recusarSaqueAction } from "../actions";

export function SaqueAcoes({ saqueId, chave }: { saqueId: string; chave: string }) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <CopiarBotao texto={chave} rotulo="Copiar chave" aviso="Chave copiada" />
      <ConfirmarComTexto
        rotuloBotao="Marcar como pago"
        variante="primario"
        titulo="Confirmar pagamento do saque"
        descricao="Confirme só depois de fazer o Pix. O afiliado recebe um e-mail avisando."
        rotuloCampo="ID da transação ou observação (opcional)"
        obrigatorio={false}
        rotuloConfirmar="Confirmar pagamento"
        avisoSucesso="Saque marcado como pago."
        onConfirmar={(texto) => pagarSaqueAction(saqueId, texto)}
      />
      <ConfirmarComTexto
        rotuloBotao="Recusar"
        titulo="Recusar saque"
        descricao="O valor volta para o saldo do afiliado e ele é avisado por e-mail com o motivo."
        rotuloCampo="Motivo"
        obrigatorio
        rotuloConfirmar="Recusar saque"
        avisoSucesso="Saque recusado; o saldo voltou ao afiliado."
        onConfirmar={(texto) => recusarSaqueAction(saqueId, texto)}
      />
    </div>
  );
}
