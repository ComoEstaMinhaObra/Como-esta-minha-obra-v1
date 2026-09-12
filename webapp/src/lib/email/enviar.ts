import "server-only";
import { Resend } from "resend";
import { createElement } from "react";
import { getServerEnv, publicEnv } from "@/config/env";
import { createClient } from "@/lib/supabase/server";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { ConviteAcessoEmail } from "@/emails/convite-acesso";
import { NovoRelatorioEmail } from "@/emails/novo-relatorio";
import { RetificacaoRelatorioEmail } from "@/emails/retificacao-relatorio";
import { logSeguro } from "@/lib/log";

function resendOuNull() {
  try {
    const env = getServerEnv();
    if (
      !env.RESEND_API_KEY ||
      env.RESEND_API_KEY.startsWith("preencher") ||
      env.RESEND_API_KEY === "re_xxx"
    ) {
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
  logSeguro("info", { evento: "email_convite" });

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

async function destinatariosAtivos(obraId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data: acessos } = await supabase
    .from("obra_acessos")
    .select("email, status")
    .eq("obra_id", obraId)
    .in("status", ["convidado", "ativo"]);
  return (acessos ?? []).map((a) => a.email);
}

export async function enviarEmailNovoRelatorio(params: {
  obraId: string;
  numero: number;
  snapshot: RelatorioSnapshot;
}) {
  const emails = await destinatariosAtivos(params.obraId);
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/c/${params.obraId}`;
  const resend = resendOuNull();
  let from = publicEnv.NEXT_PUBLIC_APP_URL;
  try {
    from = getServerEnv().EMAIL_FROM;
  } catch {
    /* ignore */
  }

  logSeguro("info", {
    evento: "email_relatorio",
    ids: { obraId: params.obraId, numero: params.numero, n: emails.length },
  });

  if (!resend) return;
  for (const para of emails) {
    await resend.emails.send({
      from,
      to: para,
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

export async function enviarEmailRetificacao(params: {
  obraId: string;
  numero: number;
  versaoNumero: number;
  snapshot: RelatorioSnapshot;
}) {
  const emails = await destinatariosAtivos(params.obraId);
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/c/${params.obraId}`;
  const resend = resendOuNull();
  let from = publicEnv.NEXT_PUBLIC_APP_URL;
  try {
    from = getServerEnv().EMAIL_FROM;
  } catch {
    /* ignore */
  }

  logSeguro("info", {
    evento: "email_retificacao",
    ids: { obraId: params.obraId, numero: params.numero, versao: params.versaoNumero },
  });

  if (!resend) return;
  for (const para of emails) {
    await resend.emails.send({
      from,
      to: para,
      subject: `Relatório nº ${params.numero} da obra ${params.snapshot.obra.nome} foi retificado`,
      react: createElement(RetificacaoRelatorioEmail, {
        obraNome: params.snapshot.obra.nome,
        numero: params.numero,
        versaoNumero: params.versaoNumero,
        avancoAntes: params.snapshot.avancoFisico.geralAntes,
        avancoDepois: params.snapshot.avancoFisico.geralDepois,
        link,
      }),
    });
  }
}
