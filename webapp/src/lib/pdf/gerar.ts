import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { RelatorioPdfDocument } from "@/lib/pdf/relatorio-pdf";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { createClient } from "@/lib/supabase/server";

export async function gerarESalvarPdfRelatorio(params: {
  relatorioId: string;
  obraId: string;
  numero: number;
  snapshot: RelatorioSnapshot;
}) {
  const buffer = await renderToBuffer(
    createElement(RelatorioPdfDocument, {
      snapshot: params.snapshot,
    }) as unknown as ReactElement<DocumentProps>,
  );

  const pdfPath = `${params.obraId}/relatorio-${String(params.numero).padStart(2, "0")}.pdf`;
  const supabase = await createClient();

  const { error: upErr } = await supabase.storage
    .from("pdfs")
    .upload(pdfPath, buffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (upErr) {
    console.error("[pdf] upload falhou", upErr);
    throw upErr;
  }

  const { error } = await supabase
    .from("relatorios")
    .update({ pdf_path: pdfPath })
    .eq("id", params.relatorioId);

  if (error) {
    console.error("[pdf] update path falhou", error);
    throw error;
  }

  return pdfPath;
}
