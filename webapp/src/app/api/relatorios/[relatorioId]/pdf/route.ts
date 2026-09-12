import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ relatorioId: string }> },
) {
  const { relatorioId } = await context.params;
  const url = new URL(request.url);
  const versaoId = url.searchParams.get("versao");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }

  const { data: relatorio } = await supabase
    .from("relatorios")
    .select("id, obra_id, status, versao_atual_id, versao_pendente_id")
    .eq("id", relatorioId)
    .maybeSingle();

  if (!relatorio) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  if (relatorio.status === "processando" && !versaoId) {
    return new NextResponse("Relatório em processamento", { status: 202 });
  }

  const alvo = versaoId ?? relatorio.versao_atual_id;
  if (!alvo) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const { data: versao } = await supabase
    .from("relatorio_versoes")
    .select("id, status, pdf_path")
    .eq("id", alvo)
    .eq("relatorio_id", relatorioId)
    .maybeSingle();

  if (!versao || versao.status !== "publicada" || !versao.pdf_path) {
    if (versao?.status === "processando") {
      return new NextResponse("Relatório em processamento", { status: 202 });
    }
    return new NextResponse("Não encontrado", { status: 404 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("pdfs")
    .createSignedUrl(versao.pdf_path, 60 * 15);

  if (signErr || !signed?.signedUrl) {
    return new NextResponse("Falha ao assinar URL", { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
