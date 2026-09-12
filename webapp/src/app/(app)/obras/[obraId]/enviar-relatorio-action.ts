"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { gerarPdfCreateOnly } from "@/lib/pdf/gerar";
import { logSeguro, sanitizarErro } from "@/lib/log";
import type { RelatorioRascunho, RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { codigoRpc } from "@/lib/rpc-erros";
import type { Json } from "@/lib/database.types";

export async function enviarRelatorioAction(relatorioId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: prep, error } = await supabase.rpc("fn_preparar_envio_relatorio", {
    p_relatorio: relatorioId,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const p = prep as unknown as {
    versaoId: string;
    relatorioId: string;
    obraId: string;
    numero: number;
    versaoNumero: number;
    snapshot: RelatorioSnapshot;
  };

  const admin = createAdminClient();
  try {
    const pdf = await gerarPdfCreateOnly({
      obraId: p.obraId,
      relatorioId: p.relatorioId,
      versaoNumero: p.versaoNumero,
      snapshot: p.snapshot,
    });
    const { error: finErr } = await admin.rpc("fn_finalizar_envio_relatorio", {
      p_versao: p.versaoId,
      p_pdf_path: pdf.path,
      p_pdf_sha256: pdf.sha256,
    });
    if (finErr) {
      await admin.rpc("fn_marcar_versao_falhou", {
        p_versao: p.versaoId,
        p_erro: sanitizarErro(finErr),
      });
      return { ok: false as const, erro: codigoRpc(finErr) };
    }
  } catch (e) {
    await admin.rpc("fn_marcar_versao_falhou", {
      p_versao: p.versaoId,
      p_erro: sanitizarErro(e),
    });
    logSeguro("error", { evento: "pdf_envio", ids: { versaoId: p.versaoId } });
    return { ok: false as const, erro: "FALHA_PDF" };
  }

  try {
    const { enviarEmailNovoRelatorio } = await import("@/lib/email/enviar");
    await enviarEmailNovoRelatorio({
      obraId: p.obraId,
      numero: p.numero,
      snapshot: p.snapshot,
    });
  } catch (e) {
    logSeguro("error", { evento: "email_relatorio", ids: { obraId: p.obraId } });
    void sanitizarErro(e);
  }

  revalidatePath(`/obras/${p.obraId}`);
  return { ok: true as const, numero: p.numero, snapshot: p.snapshot };
}

export async function retificarRelatorioAction(params: {
  relatorioId: string;
  motivo: string;
  dados: RelatorioRascunho;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: prep, error } = await supabase.rpc("fn_preparar_retificacao", {
    p_relatorio: params.relatorioId,
    p_motivo: params.motivo,
    p_dados: params.dados as unknown as Json,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const p = prep as unknown as {
    versaoId: string;
    relatorioId: string;
    obraId: string;
    numero: number;
    versaoNumero: number;
    snapshot: RelatorioSnapshot;
  };

  const admin = createAdminClient();
  try {
    const pdf = await gerarPdfCreateOnly({
      obraId: p.obraId,
      relatorioId: p.relatorioId,
      versaoNumero: p.versaoNumero,
      snapshot: p.snapshot,
    });
    const { error: finErr } = await admin.rpc("fn_finalizar_retificacao", {
      p_versao: p.versaoId,
      p_pdf_path: pdf.path,
      p_pdf_sha256: pdf.sha256,
    });
    if (finErr) {
      await admin.rpc("fn_marcar_versao_falhou", {
        p_versao: p.versaoId,
        p_erro: sanitizarErro(finErr),
      });
      return { ok: false as const, erro: codigoRpc(finErr) };
    }
  } catch (e) {
    await admin.rpc("fn_marcar_versao_falhou", {
      p_versao: p.versaoId,
      p_erro: sanitizarErro(e),
    });
    return { ok: false as const, erro: "FALHA_PDF" };
  }

  try {
    const { enviarEmailRetificacao } = await import("@/lib/email/enviar");
    await enviarEmailRetificacao({
      obraId: p.obraId,
      numero: p.numero,
      versaoNumero: p.versaoNumero,
      snapshot: p.snapshot,
    });
  } catch (e) {
    logSeguro("error", { evento: "email_retificacao", ids: { obraId: p.obraId } });
    void sanitizarErro(e);
  }

  revalidatePath(`/obras/${p.obraId}`);
  return { ok: true as const, numero: p.numero, versaoNumero: p.versaoNumero };
}
