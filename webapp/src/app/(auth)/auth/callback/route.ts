import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_REF, normalizarCodigo } from "@/lib/afiliados/codigo";
import { logSeguro } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

// Decide o destino pós-autenticação. Chamado com `code` (confirmação de
// cadastro / recuperação de senha) ou sem `code`, já com sessão (login por
// e-mail e senha feito no client).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const supabase = await createClient();
  const cookieStore = await cookies();
  const refCookie = cookieStore.get(COOKIE_REF)?.value;

  // Com usuário autenticado o cookie de afiliado cumpre o papel (ou não vale mais): sai em todo
  // redirect. Em erro de autenticação fica, para a próxima tentativa.
  let limparRef = false;
  const redirecionar = (destino: string) => {
    const resposta = NextResponse.redirect(`${origin}${destino}`);
    if (limparRef && refCookie !== undefined) {
      resposta.cookies.set(COOKIE_REF, "", { path: "/", maxAge: 0 });
    }
    return resposta;
  };

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return redirecionar("/entrar?erro=auth");
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirecionar("/entrar?erro=auth");
  }

  limparRef = true;

  // Login social (e confirmação no mesmo navegador): atribui a conta recém-criada ao link. O
  // banco decide (conta nova, link ativo, sem indicação prévia); falha aqui nunca bloqueia o login.
  const codigoRef = normalizarCodigo(refCookie);
  if (codigoRef) {
    try {
      const { error } = await supabase.rpc("fn_afiliado_registrar_indicacao", {
        p_codigo: codigoRef,
      });
      if (error) logSeguro("error", { evento: "afiliado_registrar_indicacao" });
    } catch {
      logSeguro("error", { evento: "afiliado_registrar_indicacao" });
    }
  }

  if (next && next.startsWith("/")) {
    return redirecionar(next);
  }

  const { data: acessos } = await supabase
    .from("obra_acessos")
    .select("obra_id")
    .eq("user_id", user.id)
    .eq("status", "ativo")
    .order("criado_em", { ascending: false })
    .limit(1);

  const { data: obras } = await supabase
    .from("obras")
    .select("id")
    .eq("owner_id", user.id)
    .is("arquivada_em", null)
    .limit(1);

  const soProprietario = (acessos?.length ?? 0) > 0 && (obras?.length ?? 0) === 0;

  if (soProprietario && acessos?.[0]?.obra_id) {
    return redirecionar(`/c/${acessos[0].obra_id}`);
  }

  return redirecionar("/obras");
}
