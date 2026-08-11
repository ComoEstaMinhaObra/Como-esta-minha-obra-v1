"use server";

import { revalidatePath } from "next/cache";
import { enviarEmailConvite } from "@/lib/email/enviar";
import { createClient } from "@/lib/supabase/server";

export async function reenviarConvitesProprietario(userId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: ehAdmin } = await supabase.rpc("is_admin");
  if (!ehAdmin) return { ok: false as const, erro: "SEM_PERMISSAO" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", userId)
    .maybeSingle();

  const { data: obras } = await supabase
    .from("obras")
    .select("id, nome")
    .eq("owner_id", userId)
    .is("arquivada_em", null);

  if (!obras?.length) {
    return { ok: true as const, enviados: 0 };
  }

  const obraIds = obras.map((o) => o.id);
  const { data: acessos } = await supabase
    .from("obra_acessos")
    .select("email, obra_id, status")
    .in("obra_id", obraIds)
    .eq("status", "convidado");

  const nomeObra = new Map(obras.map((o) => [o.id, o.nome]));
  let enviados = 0;

  for (const a of acessos ?? []) {
    try {
      await enviarEmailConvite({
        para: a.email,
        empreiteiro: profile?.nome || "Empreiteiro",
        obraNome: nomeObra.get(a.obra_id) || "obra",
      });
      enviados += 1;
    } catch (e) {
      console.error("[admin:reenviar-convite]", e);
    }
  }

  revalidatePath(`/admin/contas/${userId}`);
  return { ok: true as const, enviados };
}
