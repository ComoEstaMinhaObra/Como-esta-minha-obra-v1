"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function arquivarObraAction(obraId: string, nomeConfirmacao: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: obra } = await supabase
    .from("obras")
    .select("id, nome, owner_id, arquivada_em")
    .eq("id", obraId)
    .maybeSingle();

  if (!obra || obra.owner_id !== user.id) {
    return { ok: false as const, erro: "SEM_PERMISSAO" };
  }

  if (obra.arquivada_em) {
    return { ok: false as const, erro: "JA_ARQUIVADA" };
  }

  if (nomeConfirmacao.trim() !== obra.nome) {
    return { ok: false as const, erro: "NOME_NAO_CONFERE" };
  }

  const { error } = await supabase
    .from("obras")
    .update({ arquivada_em: new Date().toISOString() })
    .eq("id", obraId)
    .eq("owner_id", user.id);

  if (error) return { ok: false as const, erro: error.message };

  revalidatePath("/obras");
  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const };
}
