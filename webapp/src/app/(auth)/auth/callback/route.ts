import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Decide o destino pós-autenticação. Chamado com `code` (confirmação de
// cadastro / recuperação de senha) ou sem `code`, já com sessão (login por
// e-mail e senha feito no client).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/entrar?erro=auth`);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/entrar?erro=auth`);
  }

  if (next && next.startsWith("/")) {
    return NextResponse.redirect(`${origin}${next}`);
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
    return NextResponse.redirect(`${origin}/c/${acessos[0].obra_id}`);
  }

  return NextResponse.redirect(`${origin}/obras`);
}
