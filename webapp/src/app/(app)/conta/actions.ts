"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelarAssinatura, MercadoPagoError } from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { sanitizarErro } from "@/lib/log";

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}

export async function cancelarAssinaturaConta() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, erro: "NAO_AUTENTICADO" };

  const { data: assinatura } = await supabase
    .from("assinaturas")
    .select("id, status, provedor_assinatura_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assinatura || assinatura.status !== "ativa") {
    return { ok: false as const, erro: "SEM_ASSINATURA_ATIVA" };
  }
  if (!assinatura.provedor_assinatura_id) {
    return { ok: false as const, erro: "SEM_SUBSCRIPTION_ID" };
  }

  try {
    await cancelarAssinatura(assinatura.provedor_assinatura_id);
  } catch (e) {
    const msg = e instanceof MercadoPagoError ? sanitizarErro(e) : "CANCELAR";
    return { ok: false as const, erro: `CANCELAR: ${msg}` };
  }

  revalidatePath("/conta");
  revalidatePath("/cobranca");
  return { ok: true as const };
}
