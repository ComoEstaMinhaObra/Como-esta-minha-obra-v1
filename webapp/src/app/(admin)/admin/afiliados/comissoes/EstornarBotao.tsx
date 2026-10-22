"use client";

import { ConfirmarComTexto } from "../ConfirmarComTexto";
import { estornarComissaoAction } from "../actions";

export function EstornarBotao({ lancamentoId }: { lancamentoId: string }) {
  return (
    <ConfirmarComTexto
      rotuloBotao="Estornar"
      titulo="Estornar comissão"
      descricao="Use quando o pagamento foi reembolsado ou contestado no Mercado Pago. O valor sai do saldo do afiliado (pode ficar negativo se ele já sacou) e não dá para desfazer."
      rotuloCampo="Motivo"
      obrigatorio
      rotuloConfirmar="Estornar comissão"
      avisoSucesso="Comissão estornada."
      onConfirmar={(texto) => estornarComissaoAction(lancamentoId, texto)}
    />
  );
}
