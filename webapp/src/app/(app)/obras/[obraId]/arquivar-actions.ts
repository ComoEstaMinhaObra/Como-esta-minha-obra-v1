"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processarOutbox } from "@/lib/outbox";
import { codigoRpc } from "@/lib/rpc-erros";

export async function arquivarObraAction(obraId: string, nomeConfirmacao: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data, error } = await supabase.rpc("fn_arquivar_obra", {
    p_obra: obraId,
    p_nome: nomeConfirmacao,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const r = data as { outboxIds?: string[] };
  for (const id of r.outboxIds ?? []) {
    await processarOutbox(id);
  }

  revalidatePath("/obras");
  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const };
}
