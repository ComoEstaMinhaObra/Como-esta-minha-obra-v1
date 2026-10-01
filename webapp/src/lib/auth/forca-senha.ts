export type NivelSenha = "vazia" | "fraca" | "media" | "forte";

export interface AvaliacaoSenha {
  nivel: NivelSenha;
  /** O que ainda falta para a senha chegar a "média". Vazio quando já é aceita. */
  faltando: string[];
}

export const TAMANHO_MINIMO_SENHA = 8;
const TAMANHO_SENHA_FORTE = 12;

// Bases comuns; a checagem ignora maiúsculas e sufixos numéricos/símbolos
// ("Senha123!" cai em "senha").
const BASES_COMUNS = new Set([
  "senha",
  "senhas",
  "password",
  "passw0rd",
  "qwerty",
  "qwertyui",
  "qwertyuiop",
  "abcdefgh",
  "abcdefghi",
  "admin",
  "administrador",
  "brasil",
  "mudar",
  "obra",
  "obras",
  "engenheiro",
  "empreiteiro",
  "comoestaminhaobra",
  "cemo",
]);

function ehComum(senha: string): boolean {
  const base = senha.toLowerCase().replace(/[^a-z]+$/, "");
  return BASES_COMUNS.has(base) || BASES_COMUNS.has(senha.toLowerCase());
}

export function avaliarSenha(senha: string): AvaliacaoSenha {
  if (senha.length === 0) return { nivel: "vazia", faltando: [] };

  const temMinuscula = /[a-z]/.test(senha);
  const temMaiuscula = /[A-Z]/.test(senha);
  const temNumero = /\d/.test(senha);
  const temSimbolo = /[^A-Za-z0-9]/.test(senha);

  const faltando: string[] = [];
  if (senha.length < TAMANHO_MINIMO_SENHA) {
    faltando.push(`mínimo de ${TAMANHO_MINIMO_SENHA} caracteres`);
  }
  if (!temMinuscula) faltando.push("uma letra minúscula");
  if (!temMaiuscula) faltando.push("uma letra maiúscula");
  if (!temNumero) faltando.push("um número");

  if (faltando.length > 0) return { nivel: "fraca", faltando };

  if (ehComum(senha)) {
    return { nivel: "fraca", faltando: ["evite senhas comuns"] };
  }
  if (new Set(senha).size < 4) {
    return { nivel: "fraca", faltando: ["evite repetir os mesmos caracteres"] };
  }

  const forte = senha.length >= TAMANHO_SENHA_FORTE || temSimbolo;
  return { nivel: forte ? "forte" : "media", faltando: [] };
}

/** Regra de aceite: pelo menos média. */
export function senhaAceita(senha: string): boolean {
  const { nivel } = avaliarSenha(senha);
  return nivel === "media" || nivel === "forte";
}

export const MENSAGEM_REGRA_SENHA = `A senha precisa ter pelo menos ${TAMANHO_MINIMO_SENHA} caracteres, com maiúscula, minúscula e número.`;
