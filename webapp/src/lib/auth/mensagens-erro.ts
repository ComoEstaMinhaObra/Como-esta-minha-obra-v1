import { MENSAGEM_REGRA_SENHA } from "@/lib/auth/forca-senha";

export const MENSAGEM_EMAIL_NAO_CONFIRMADO =
  "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";

export function emailNaoConfirmado(mensagem: string): boolean {
  return mensagem.includes("Email not confirmed");
}

export function mensagemDeErro(mensagem: string, codigo?: string): string {
  if (mensagem.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (emailNaoConfirmado(mensagem)) {
    return MENSAGEM_EMAIL_NAO_CONFIRMADO;
  }
  if (
    codigo === "over_email_send_rate_limit" ||
    codigo === "over_request_rate_limit" ||
    mensagem.toLowerCase().includes("rate limit") ||
    mensagem.toLowerCase().includes("security purposes")
  ) {
    return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  }
  if (
    mensagem.includes("Password should") ||
    mensagem.toLowerCase().includes("weak")
  ) {
    return MENSAGEM_REGRA_SENHA;
  }
  return "Não foi possível concluir. Tente novamente.";
}
