"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AbacatePayError, cancelarAssinatura } from "@/lib/abacatepay";
import { createClient } from "@/lib/supabase/server";

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
    .select("id, status, abacatepay_subscription_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!assinatura || assinatura.status !== "ativa") {
    return { ok: false as const, erro: "SEM_ASSINATURA_ATIVA" };
  }
  if (!assinatura.abacatepay_subscription_id) {
    return { ok: false as const, erro: "SEM_SUBSCRIPTION_ID" };
  }

  try {
    await cancelarAssinatura(assinatura.abacatepay_subscription_id);
  } catch (e) {
    const msg = e instanceof AbacatePayError ? e.message : String(e);
    return { ok: false as const, erro: `CANCELAR: ${msg}` };
  }

  // Webhook subscription.cancelled confirma; update otimista para UX.
  await supabase
    .from("assinaturas")
    .update({
      status: "cancelada",
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", assinatura.id);

  revalidatePath("/conta");
  revalidatePath("/planos");
  return { ok: true as const };
}
