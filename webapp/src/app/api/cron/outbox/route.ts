import { NextResponse } from "next/server";
import { getCronEnv } from "@/config/env";
import { enviarEmailConvite } from "@/lib/email/enviar";
import { executarJobCobranca } from "@/lib/cobranca/job";
import { logSeguro } from "@/lib/log";
import { processarOutbox } from "@/lib/outbox";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const env = getCronEnv();
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Plano Hobby: no máximo 2 crons; o job da cobrança por obra roda junto da outbox, uma vez por
  // dia, e antes dela, para não depender de a outbox estar disponível.
  let cobranca: Awaited<ReturnType<typeof executarJobCobranca>> | null = null;
  try {
    cobranca = await executarJobCobranca(admin);
  } catch {
    logSeguro("error", { evento: "cobranca_job_diario" });
  }

  const { data, error } = await admin.rpc("fn_listar_outbox_pendente");
  if (error) {
    return NextResponse.json({ erro: "OUTBOX_INDISPONIVEL", cobranca }, { status: 500 });
  }

  const itens = (data ?? []) as unknown as { id: string }[];
  let processadas = 0;
  let falhas = 0;
  for (const item of itens.slice(0, 50)) {
    const resultado = await processarOutbox(item.id);
    if (!resultado.ok) {
      falhas += 1;
      continue;
    }
    processadas += 1;

    if (resultado.enviarEmail && resultado.email && resultado.obraId) {
      const { data: obra } = await admin
        .from("obras")
        .select("nome, owner_id")
        .eq("id", resultado.obraId)
        .maybeSingle();
      const { data: perfil } = obra
        ? await admin
            .from("profiles")
            .select("nome")
            .eq("id", obra.owner_id)
            .maybeSingle()
        : { data: null };
      try {
        await enviarEmailConvite({
          para: resultado.email,
          empreiteiro: perfil?.nome || "Empreiteiro",
          obraNome: obra?.nome || "obra",
        });
      } catch {
        logSeguro("error", {
          evento: "outbox_email_convite",
          ids: { obraId: resultado.obraId },
        });
      }
    }
  }

  return NextResponse.json({
    encontradas: itens.length,
    processadas,
    falhas,
    cobranca,
  });
}
