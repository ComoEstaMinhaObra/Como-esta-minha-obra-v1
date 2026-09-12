import "server-only";
import { createHash } from "node:crypto";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { RelatorioPdfDocument } from "@/lib/pdf/relatorio-pdf";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { createAdminClient } from "@/lib/supabase/admin";

export function caminhoPdfCanonico(
  obraId: string,
  relatorioId: string,
  versaoNumero: number,
  sha256: string,
): string {
  return `${obraId}/${relatorioId}/v${versaoNumero}-${sha256}.pdf`;
}

export async function gerarPdfCreateOnly(params: {
  obraId: string;
  relatorioId: string;
  versaoNumero: number;
  snapshot: RelatorioSnapshot;
}): Promise<{ path: string; sha256: string }> {
  const buffer = await renderToBuffer(
    createElement(RelatorioPdfDocument, {
      snapshot: params.snapshot,
    }) as unknown as ReactElement<DocumentProps>,
  );
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const path = caminhoPdfCanonico(
    params.obraId,
    params.relatorioId,
    params.versaoNumero,
    sha256,
  );
  const admin = createAdminClient();
  const { error } = await admin.storage.from("pdfs").upload(path, buffer, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("exists") || msg.includes("duplicate")) {
      const { data: existente, error: downloadError } = await admin.storage
        .from("pdfs")
        .download(path);
      if (downloadError || !existente) throw downloadError ?? error;
      const hashExistente = createHash("sha256")
        .update(Buffer.from(await existente.arrayBuffer()))
        .digest("hex");
      if (hashExistente !== sha256) {
        throw new Error("PDF_EXISTENTE_DIVERGENTE");
      }
      return { path, sha256 };
    }
    throw error;
  }
  return { path, sha256 };
}
