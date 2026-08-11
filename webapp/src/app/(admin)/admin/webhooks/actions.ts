"use server";

import { revalidatePath } from "next/cache";
import {
  marcarWebhookProcessado,
  processarEventoAssinatura,
  type WebhookPayload,
} from "@/lib/abacatepay-webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

export async function reprocessarWebhookAction(logId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: ehAdmin } = await supabase.rpc("is_admin");
  if (!ehAdmin) return { ok: false as const, erro: "SEM_PERMISSAO" };

  const { data: log, error } = await supabase
    .from("webhooks_log")
    .select("id, payload, evento")
    .eq("id", logId)
    .maybeSingle();

  if (error || !log) {
    return { ok: false as const, erro: "NAO_ENCONTRADO" };
  }

  const admin = createAdminClient();

  // Libera idempotência desta linha para permitir novo processamento
  await marcarWebhookProcessado(admin, logId, false, null);

  try {
    const resultado = await processarEventoAssinatura(
      admin,
      log.payload as WebhookPayload,
    );
    await marcarWebhookProcessado(
      admin,
      logId,
      true,
      resultado.ok ? null : resultado.mensagem,
    );
    revalidatePath("/admin/webhooks");
    return { ok: true as const, mensagem: resultado.mensagem };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro desconhecido";
    await marcarWebhookProcessado(admin, logId, false, msg);
    // Mantém payload no log (já existe) — só atualiza erro
    void (log.payload as Json);
    revalidatePath("/admin/webhooks");
    return { ok: false as const, erro: msg };
  }
}
