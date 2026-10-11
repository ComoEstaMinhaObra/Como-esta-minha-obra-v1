"use server";

import { revalidatePath } from "next/cache";
import { processarNotificacaoMp } from "@/lib/cobranca/mercadopago-webhook";
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

  // O log guarda o tipo (coluna evento) e o id do recurso consultado; reprocessar consulta o estado de novo.
  const registro = data as {
    eventId: string;
    evento: string;
    payload: { dataId?: string; acao?: string | null };
  };
  const dataId = registro.payload?.dataId;
  if (!dataId) return { ok: false as const, erro: "WEBHOOK_SEM_RECURSO" };
  const admin = createAdminClient();
  try {
    const resultado = await processarNotificacaoMp(
      admin,
      { tipo: registro.evento, dataId, acao: registro.payload.acao ?? undefined },
      { forcar: true, eventId: registro.eventId },
    );
    revalidatePath("/admin/webhooks");
    return { ok: true as const, mensagem: resultado.mensagem };
  } catch (e) {
    revalidatePath("/admin/webhooks");
    return { ok: false as const, erro: sanitizarErro(e) };
  }
}
