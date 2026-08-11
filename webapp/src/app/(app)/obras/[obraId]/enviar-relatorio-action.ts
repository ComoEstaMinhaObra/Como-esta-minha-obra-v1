"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { publicEnv } from "@/config/env";

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

  // E-mail (S2.10): log em dev; Resend quando key válida
  const { data: acessos } = await supabase
    .from("obra_acessos")
    .select("email, status")
    .eq("obra_id", rel.obra_id);

  for (const a of acessos ?? []) {
    console.info("[email:novo-relatorio]", {
      para: a.email,
      numero: rel.numero,
      obra: snap.obra?.nome,
      avanco: `${snap.avancoFisico?.geralAntes}% → ${snap.avancoFisico?.geralDepois}%`,
      link: `${publicEnv.NEXT_PUBLIC_APP_URL}/c/${rel.obra_id}`,
    });
  }

  revalidatePath(`/obras/${rel.obra_id}`);
  return {
    ok: true as const,
    numero: rel.numero,
    snapshot: snap,
  };
}
