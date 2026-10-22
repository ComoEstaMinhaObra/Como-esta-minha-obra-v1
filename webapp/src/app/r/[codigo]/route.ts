import { NextResponse } from "next/server";
import {
  COOKIE_REF,
  OPCOES_COOKIE_REF,
  normalizarCodigo,
} from "@/lib/afiliados/codigo";

/**
 * Link de divulgação de afiliado: /r/<codigo>. Guarda o código num cookie (último clique vence,
 * 30 dias) e leva para a página inicial. Não toca no banco: a existência do link é conferida só
 * no cadastro. 307 sem cache, senão o navegador pularia o cookie nos próximos cliques.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo: bruto } = await params;
  const codigo = normalizarCodigo(bruto);

  const url = new URL(request.url);
  const destino = new URL("/", url.origin);
  destino.search = url.search; // mantém utm_* da campanha

  const resposta = NextResponse.redirect(destino, 307);
  resposta.headers.set("Cache-Control", "no-store");
  if (codigo) {
    resposta.cookies.set(COOKIE_REF, codigo, {
      ...OPCOES_COOKIE_REF,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return resposta;
}
