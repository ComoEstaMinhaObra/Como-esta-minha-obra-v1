"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";

export async function enviarRelatorioAction(relatorioId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: rel } = await supabase
    .from("relatorios")
    .select("id, obra_id, numero, status")
    .eq("id", relatorioId)
    .maybeSingle();
  if (!rel || rel.status !== "rascunho") {
    return { ok: false as const, erro: "RELATORIO_INVALIDO" };
  }

  const { data: snapshot, error } = await supabase.rpc("fn_enviar_relatorio", {
    p_relatorio: relatorioId,
  });

  if (error) {
    const msg = error.message;
    if (msg.includes("TRIAL_LIMITE")) return { ok: false as const, erro: "TRIAL_LIMITE" };
    if (msg.includes("TRIAL_EXPIRADO")) return { ok: false as const, erro: "TRIAL_EXPIRADO" };
    if (msg.includes("ASSINATURA_INATIVA"))
      return { ok: false as const, erro: "ASSINATURA_INATIVA" };
    if (msg.includes("PCT_REGREDIU")) {
      console.error("[enviar_relatorio] PCT_REGREDIU", error);
      return { ok: false as const, erro: "ERRO_GENERICO" };
    }
    return { ok: false as const, erro: msg };
  }

  const snap = snapshot as unknown as RelatorioSnapshot;

  // PDF pós-envio: falha não desfaz o envio (retry na rota de download)
  try {
    const { gerarESalvarPdfRelatorio } = await import("@/lib/pdf/gerar");
    await gerarESalvarPdfRelatorio({
      relatorioId: rel.id,
      obraId: rel.obra_id,
      numero: rel.numero,
      snapshot: snap,
    });
  } catch (e) {
    console.error("[pdf] geração pós-envio falhou (retry disponível)", e);
  }

  // E-mail (S2.10): log em dev; Resend quando key válida
  try {
    const { enviarEmailNovoRelatorio } = await import("@/lib/email/enviar");
    await enviarEmailNovoRelatorio({
      obraId: rel.obra_id,
      numero: rel.numero,
      snapshot: snap,
    });
  } catch (e) {
    console.error("[email] falha no envio (não desfaz relatório)", e);
  }

  revalidatePath(`/obras/${rel.obra_id}`);
  return {
    ok: true as const,
    numero: rel.numero,
    snapshot: snap,
  };
}
