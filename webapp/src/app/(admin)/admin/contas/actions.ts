"use server";

import { revalidatePath } from "next/cache";
import { enviarEmailConvite } from "@/lib/email/enviar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logSeguro } from "@/lib/log";

export async function reenviarConvitesProprietario(userId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: ehAdmin } = await supabase.rpc("fn_sou_admin");
  if (!ehAdmin) return { ok: false as const, erro: "SEM_PERMISSAO" };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("nome")
    .eq("id", userId)
    .maybeSingle();
  const { data: obras } = await admin
    .from("obras")
    .select("id, nome")
    .eq("owner_id", userId)
    .is("arquivada_em", null);
  if (!obras?.length) return { ok: true as const, enviados: 0 };

  const { data: acessos } = await admin
    .from("obra_acessos")
    .select("email, obra_id, status")
    .in(
      "obra_id",
      obras.map((o) => o.id),
    )
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
    } catch {
      logSeguro("error", { evento: "admin_reenviar_convite" });
    }
  }
  revalidatePath(`/admin/contas/${userId}`);
  return { ok: true as const, enviados };
}
