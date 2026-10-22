import { MENSAGENS_PROBLEMA_FINANCEIRO } from "@/lib/relatorios/calculos";

export function codigoRpc(
  erro: { message?: string } | null | undefined,
): string {
  const msg = erro?.message ?? "";
  const conhecido = [
    "NAO_AUTENTICADO",
    "SEM_PERMISSAO",
    "ASSINATURA_AUSENTE",
    "ASSINATURA_INATIVA",
    "TRIAL_EXPIRADO",
    "TRIAL_LIMITE",
    "LIMITE_OBRAS",
    "DADOS_INVALIDOS",
    "DATAS_INVALIDAS",
    "RATE_LIMITED",
    "EMAIL_INVALIDO",
    "EMAIL_PROPRIO",
    "EMAIL_DUPLICADO",
    "PRECISA_ASSINAR",
    "RELATORIO_INVALIDO",
    "RELATORIO_AUSENTE",
    "RASCUNHO_INVALIDO",
    "RASCUNHO_DUPLICADO",
    "ETAPA_INVALIDA",
    "PESOS_ETAPAS_INVALIDOS",
    "PCT_INVALIDO",
    "PCT_REGREDIU",
    "PCT_ABAIXO_PISO",
    "LIMITE_FOTOS",
    "FOTO_SEM_RESERVA",
    "FOTO_PUBLICADA",
    "FOTO_AUSENTE",
    "ENVIO_PENDENTE",
    "VERSAO_PENDENTE",
    "VERSAO_AUSENTE",
    "VERSAO_INVALIDA",
    "VALOR_INVALIDO",
    "CONTRATADO_INVALIDO",
    "PAGO_NEGATIVO",
    "PAGO_ACIMA_CONTRATADO",
    "ESTORNO_ACIMA_ORIGEM",
    "ESTORNO_ORIGEM_INVALIDA",
    "PDF_HASH_INVALIDO",
    "PDF_PATH_INVALIDO",
    "PATH_INVALIDO",
    "NOME_NAO_CONFERE",
    "JA_ARQUIVADA",
    "NAO_ENCONTRADO",
    "ESTADO_INSEGURO",
    "OBRA_ARQUIVADA",
    "COBRANCA_AUSENTE",
    "COBRANCA_NAO_CANCELAVEL",
    "COBRANCA_NAO_DESFAZIVEL",
    "COBRANCA_NAO_REGULARIZAVEL",
    "CODIGO_INVALIDO",
    "CODIGO_EM_USO",
    "COMISSAO_INVALIDA",
    "DESCONTO_INVALIDO",
    "AFILIADO_NAO_ENCONTRADO",
    "LINK_NAO_ENCONTRADO",
    "CONFIG_INVALIDA",
    "MOTIVO_OBRIGATORIO",
    "LANCAMENTO_NAO_ENCONTRADO",
    "SAQUE_NAO_ENCONTRADO",
    "SAQUE_JA_RESOLVIDO",
    "CHAVE_PIX_INVALIDA",
    "SAQUE_EM_ABERTO",
    "SALDO_INSUFICIENTE",
    "SAQUE_MINIMO",
  ];
  for (const codigo of conhecido) {
    if (msg.includes(codigo)) return codigo;
  }
  return "ERRO_GENERICO";
}

export function mensagemRpc(codigo: string): string {
  switch (codigo) {
    case "RATE_LIMITED":
      return "Muitas tentativas. Aguarde alguns minutos.";
    case "ASSINATURA_INATIVA":
    case "TRIAL_EXPIRADO":
    case "TRIAL_LIMITE":
    case "PRECISA_ASSINAR":
      return "Esta obra está somente leitura. Contrate a cobrança da obra na tela de Cobrança para continuar.";
    case "LIMITE_OBRAS":
      return "No trial você pode ter uma obra. Contrate a cobrança da obra para criar outras.";
    case "COBRANCA_AUSENTE":
      return "Esta obra não tem cobrança ativa.";
    case "COBRANCA_NAO_CANCELAVEL":
      return "Esta cobrança não pode ser cancelada agora.";
    case "COBRANCA_NAO_DESFAZIVEL":
      return "O cancelamento não pode mais ser desfeito.";
    case "COBRANCA_NAO_REGULARIZAVEL":
      return "Esta obra não tem pagamento pendente para regularizar.";
    case "SEM_PERMISSAO":
      return "Você não tem permissão para esta ação.";
    case "CODIGO_INVALIDO":
      return "O código do link deve ter de 3 a 32 letras minúsculas, números ou hífens (sem hífen no começo ou no fim).";
    case "CODIGO_EM_USO":
      return "Já existe um link com esse código.";
    case "COMISSAO_INVALIDA":
      return "A comissão deve ficar entre 0% e 100%.";
    case "DESCONTO_INVALIDO":
      return "O desconto deve ficar entre 0% e 90%, com a duração escolhida.";
    case "AFILIADO_NAO_ENCONTRADO":
      return "Afiliado não encontrado. Ele precisa ter uma conta no sistema.";
    case "LINK_NAO_ENCONTRADO":
      return "Link não encontrado.";
    case "CONFIG_INVALIDA":
      return "Configuração inválida. Confira a carência (0 a 365 dias) e o valor mínimo.";
    case "MOTIVO_OBRIGATORIO":
      return "Informe o motivo.";
    case "LANCAMENTO_NAO_ENCONTRADO":
      return "Comissão não encontrada.";
    case "SAQUE_NAO_ENCONTRADO":
      return "Saque não encontrado.";
    case "SAQUE_JA_RESOLVIDO":
      return "Este saque já foi resolvido.";
    case "CHAVE_PIX_INVALIDA":
      return "Chave Pix inválida. Confira o tipo e o valor.";
    case "SAQUE_EM_ABERTO":
      return "Você já tem uma solicitação de saque em andamento.";
    case "SALDO_INSUFICIENTE":
      return "Você não tem saldo disponível para saque.";
    case "SAQUE_MINIMO":
      return "O saldo disponível está abaixo do valor mínimo para saque.";
    case "VALOR_INVALIDO":
      return "Todos os valores lançados precisam ser maiores que zero.";
    case "CONTRATADO_INVALIDO":
    case "PAGO_NEGATIVO":
    case "PAGO_ACIMA_CONTRATADO":
    case "ESTORNO_ACIMA_ORIGEM":
    case "ESTORNO_ORIGEM_INVALIDA":
      return MENSAGENS_PROBLEMA_FINANCEIRO[
        codigo === "ESTORNO_ORIGEM_INVALIDA" ? "ESTORNO_SEM_ORIGEM" : codigo
      ];
    default:
      return "Não foi possível concluir a ação.";
  }
}
