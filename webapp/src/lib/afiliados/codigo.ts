/** Cookie de atribuição: guarda o código do link de afiliado até o cadastro. */
export const COOKIE_REF = "cemo_ref";
export const COOKIE_REF_DIAS = 30;

// Mesmo formato do CHECK de private.afiliado_links.codigo.
const CODIGO_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

/** Normaliza (minúsculas, sem espaços) e valida o formato; `null` se não for um código possível. */
export function normalizarCodigo(valor: string | null | undefined): string | null {
  const codigo = (valor ?? "").trim().toLowerCase();
  return CODIGO_RE.test(codigo) ? codigo : null;
}

export const OPCOES_COOKIE_REF = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: COOKIE_REF_DIAS * 24 * 60 * 60,
} as const;
