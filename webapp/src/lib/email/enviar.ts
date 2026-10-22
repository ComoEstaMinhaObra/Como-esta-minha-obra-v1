import "server-only";
import { Resend } from "resend";
import { createElement } from "react";
import { getEmailEnv, publicEnv } from "@/config/env";
import { createClient } from "@/lib/supabase/server";
import type { RelatorioSnapshot } from "@/lib/relatorios/tipos";
import { ConviteAcessoEmail } from "@/emails/convite-acesso";
import { NovoRelatorioEmail } from "@/emails/novo-relatorio";
import { PagamentoPendenteEmail } from "@/emails/pagamento-pendente";
import { SaqueAfiliadoEmail } from "@/emails/saque-afiliado";
import { EMAIL_SUPORTE } from "@/lib/afiliados/constantes";
import { formatarBRL } from "@/lib/formatacao";
import { logSeguro } from "@/lib/log";

function resendOuNull() {
  try {
    const env = getEmailEnv();
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

  const env = getEmailEnv();
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
    from = getEmailEnv().EMAIL_FROM;
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

/** Aviso de pagamento pendente de uma obra (job diário da cobrança). Sem Resend configurado, só registra. */
export async function enviarEmailPagamentoPendente(params: {
  para: string;
  obraNome: string;
  limite: string;
}) {
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/cobranca`;
  logSeguro("info", { evento: "email_pagamento_pendente" });

  const resend = resendOuNull();
  if (!resend) return;

  await resend.emails.send({
    from: getEmailEnv().EMAIL_FROM,
    to: params.para,
    subject: `Pagamento pendente da obra ${params.obraNome}`,
    react: createElement(PagamentoPendenteEmail, {
      obraNome: params.obraNome,
      limite: params.limite,
      link,
    }),
  });
}

/** Aviso ao afiliado de que o saque foi pago ou recusado pelo suporte. Sem Resend configurado, só registra. */
export async function enviarEmailSaqueResolvido(params: {
  para: string;
  situacao: "pago" | "recusado";
  valorCentavos: number;
  observacao?: string | null;
}) {
  const link = `${publicEnv.NEXT_PUBLIC_APP_URL}/conta/afiliado`;
  logSeguro("info", { evento: "email_saque_afiliado" });

  const resend = resendOuNull();
  if (!resend) return;

  const valor = formatarBRL(params.valorCentavos);
  await resend.emails.send({
    from: getEmailEnv().EMAIL_FROM,
    to: params.para,
    subject:
      params.situacao === "pago"
        ? `Seu saque de ${valor} foi pago`
        : `Seu saque de ${valor} não foi pago`,
    react: createElement(SaqueAfiliadoEmail, {
      situacao: params.situacao,
      valor,
      observacao: params.observacao,
      link,
    }),
  });
}

/** Aviso ao suporte de que há um saque de afiliado para pagar por Pix e confirmar no admin. */
export async function enviarEmailSaqueSolicitado(params: {
  afiliadoNome: string;
  valorCentavos: number;
}) {
  logSeguro("info", { evento: "email_saque_solicitado" });

  const resend = resendOuNull();
  if (!resend) return;

  const valor = formatarBRL(params.valorCentavos);
  await resend.emails.send({
    from: getEmailEnv().EMAIL_FROM,
    to: EMAIL_SUPORTE,
    subject: `Saque de afiliado para pagar: ${valor}`,
    text: `${params.afiliadoNome || "Um afiliado"} pediu um saque de ${valor}.\n\nPague por Pix e confirme em ${publicEnv.NEXT_PUBLIC_APP_URL}/admin/afiliados/saques`,
  });
}
