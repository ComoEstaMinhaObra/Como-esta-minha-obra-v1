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
    "NAO_E_ULTIMO",
    "MOTIVO_OBRIGATORIO",
    "PDF_HASH_INVALIDO",
    "PDF_PATH_INVALIDO",
    "PATH_INVALIDO",
    "NOME_NAO_CONFERE",
    "JA_ARQUIVADA",
    "NAO_ENCONTRADO",
    "ESTADO_INSEGURO",
    "OBRA_ARQUIVADA",
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
      return "Sua assinatura não permite esta ação.";
    case "LIMITE_OBRAS":
      return "Você atingiu o limite de obras do plano.";
    case "SEM_PERMISSAO":
      return "Você não tem permissão para esta ação.";
    case "NAO_E_ULTIMO":
      return "Só é possível retificar o último relatório enviado.";
    default:
      return "Não foi possível concluir a ação.";
  }
}
