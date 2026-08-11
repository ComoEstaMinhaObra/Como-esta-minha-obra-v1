import "server-only";
import { Resend } from "resend";
import { createElement } from "react";
import { getServerEnv, publicEnv } from "@/config/env";
import { createClient } from "@/lib/supabase/server";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { ConviteAcessoEmail } from "@/emails/convite-acesso";
import { NovoRelatorioEmail } from "@/emails/novo-relatorio";

function resendOuNull() {
  try {
    const env = getServerEnv();
    if (!env.RESEND_API_KEY || env.RESEND_API_KEY.startsWith("preencher") || env.RESEND_API_KEY === "re_xxx") {
      return null;
    }
    return new Resend(env.RESEND_API_KEY);
  } catch {
    return null;
  }
}

export async function enviarEmailConvite(params: {
  para: string;
  empreiteiro: string;
  obraNome: string;
}) {
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/entrar`;
  const payload = { ...params, link };
  console.info("[email:convite-acesso]", payload);

  const resend = resendOuNull();
  if (!resend) return;

  const env = getServerEnv();
  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.para,
    subject: `${params.empreiteiro} liberou o acesso à obra ${params.obraNome}`,
    react: createElement(ConviteAcessoEmail, {
      empreiteiro: params.empreiteiro,
      obraNome: params.obraNome,
      link,
    }),
  });
}

export async function enviarEmailNovoRelatorio(params: {
  obraId: string;
  numero: number;
  snapshot: RelatorioSnapshot;
}) {
  const supabase = await createClient();
  const { data: acessos } = await supabase
    .from("obra_acessos")
    .select("email")
    .eq("obra_id", params.obraId);

  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/c/${params.obraId}`;
  const resend = resendOuNull();
  let from = publicEnv.NEXT_PUBLIC_APP_URL;
  try {
    from = getServerEnv().EMAIL_FROM;
  } catch {
    /* ignore */
  }

  for (const a of acessos ?? []) {
    const payload = {
      para: a.email,
      numero: params.numero,
      obra: params.snapshot.obra.nome,
      avanco: `${params.snapshot.avancoFisico.geralAntes}% → ${params.snapshot.avancoFisico.geralDepois}%`,
      link,
    };
    console.info("[email:novo-relatorio]", payload);

    if (!resend) continue;
    await resend.emails.send({
      from,
      to: a.email,
      subject: `Relatório nº ${params.numero} da obra ${params.snapshot.obra.nome} disponível`,
      react: createElement(NovoRelatorioEmail, {
        obraNome: params.snapshot.obra.nome,
        numero: params.numero,
        avancoAntes: params.snapshot.avancoFisico.geralAntes,
        avancoDepois: params.snapshot.avancoFisico.geralDepois,
        link,
      }),
    });
  }
}
