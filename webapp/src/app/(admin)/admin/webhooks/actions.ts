"use server";

import { revalidatePath } from "next/cache";
import { processarEventoAssinatura, type WebhookPayload } from "@/lib/abacatepay-webhook";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { codigoRpc } from "@/lib/rpc-erros";
import { sanitizarErro } from "@/lib/log";

export async function reprocessarWebhookAction(logId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data, error } = await supabase.rpc("fn_admin_reprocessar_webhook", {
    p_log: logId,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const payload = data as {
    evento: string;
    payload: WebhookPayload;
  };
  const admin = createAdminClient();
  try {
    const resultado = await processarEventoAssinatura(admin, {
      ...payload.payload,
      event: payload.evento,
    }, { forcar: true });
    revalidatePath("/admin/webhooks");
    return { ok: true as const, mensagem: resultado.mensagem };
  } catch (e) {
    revalidatePath("/admin/webhooks");
    return { ok: false as const, erro: sanitizarErro(e) };
  }
}
