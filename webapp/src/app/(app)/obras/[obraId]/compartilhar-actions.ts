"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processarOutbox } from "@/lib/outbox";
import { codigoRpc } from "@/lib/rpc-erros";
import { logSeguro } from "@/lib/log";

export async function listarAcessosObra(obraId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("obra_acessos")
    .select("id, email, status, cobrado_extra, user_id, criado_em")
    .eq("obra_id", obraId)
    .in("status", ["convidado", "ativo", "pendente_cobranca"])
    .order("criado_em", { ascending: true });
  if (error) return { ok: false as const, erro: error.message, acessos: [] };
  return { ok: true as const, acessos: data ?? [] };
}

export async function liberarAcessoObra(obraId: string, email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data, error } = await supabase.rpc("fn_solicitar_acesso_obra", {
    p_obra: obraId,
    p_email: email,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const r = data as {
    acessoId: string;
    cobradoExtra: boolean;
    status: string;
    outboxId?: string;
    enviarEmail?: boolean;
  };

  if (r.outboxId) {
    const cobranca = await processarOutbox(r.outboxId);
    if (!cobranca.ok) {
      revalidatePath(`/obras/${obraId}`);
      return { ok: false as const, erro: cobranca.erro ?? "COBRANCA_PENDENTE" };
    }
    if (cobranca.enviarEmail && cobranca.email) {
      await enviarConvite(obraId, cobranca.email, user.id);
    }
    revalidatePath(`/obras/${obraId}`);
    return { ok: true as const, cobradoExtra: true };
  }

  if (r.enviarEmail) {
    await enviarConvite(obraId, email.trim().toLowerCase(), user.id);
  }

  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const, cobradoExtra: r.cobradoExtra };
}

async function enviarConvite(obraId: string, para: string, userId: string) {
  const supabase = await createClient();
  const { data: obra } = await supabase
    .from("obras")
    .select("nome")
    .eq("id", obraId)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", userId)
    .maybeSingle();
  try {
    const { enviarEmailConvite } = await import("@/lib/email/enviar");
    await enviarEmailConvite({
      para,
      empreiteiro: profile?.nome || "Empreiteiro",
      obraNome: obra?.nome || "obra",
    });
  } catch {
    logSeguro("error", { evento: "email_convite", ids: { obraId } });
  }
}

export async function removerAcessoObra(obraId: string, acessoId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data, error } = await supabase.rpc("fn_revogar_acesso_obra", {
    p_obra: obraId,
    p_acesso: acessoId,
  });
  if (error) return { ok: false as const, erro: codigoRpc(error) };

  const r = data as { outboxId?: string | null };
  if (r.outboxId) {
    await processarOutbox(r.outboxId);
  }

  revalidatePath(`/obras/${obraId}`);
  return { ok: true as const };
}
