import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarESalvarPdfRelatorio } from "@/lib/pdf/gerar";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";

export async function GET(
  _request: Request,
  context: { params: Promise<{ relatorioId: string }> },
) {
  const { relatorioId } = await context.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/entrar", _request.url));
  }

  const { data: relatorio, error } = await supabase
    .from("relatorios")
    .select("id, obra_id, numero, status, pdf_path, snapshot")
    .eq("id", relatorioId)
    .eq("status", "enviado")
    .maybeSingle();

  // RLS: dono ou proprietário com acesso; se não achar → 404
  if (error || !relatorio || !relatorio.snapshot) {
    return new NextResponse("Não encontrado", { status: 404 });
  }

  let pdfPath = relatorio.pdf_path;

  if (!pdfPath) {
    try {
      pdfPath = await gerarESalvarPdfRelatorio({
        relatorioId: relatorio.id,
        obraId: relatorio.obra_id,
        numero: relatorio.numero,
        snapshot: relatorio.snapshot as unknown as RelatorioSnapshot,
      });
    } catch (e) {
      console.error("[pdf] retry falhou", e);
      return new NextResponse("Falha ao gerar PDF", { status: 500 });
    }
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from("pdfs")
    .createSignedUrl(pdfPath, 60 * 15);

  if (signErr || !signed?.signedUrl) {
    return new NextResponse("Falha ao assinar URL", { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
