/**
 * Backfill único: calcula o SHA-256 real dos PDFs já existentes em
 * relatorio_versoes (enviados antes da coluna pdf_sha256 existir), renomeia
 * o arquivo no storage para o formato canônico e atualiza o registro.
 *
 * Pré-requisito da migration 20260905215437_security_lockdown.sql — ela só
 * aplica se private.legado_incompativel estiver vazia.
 *
 * Uso: npm run backfill:pdf-hash
 * Requer SUPABASE_SECRET_KEY real em webapp/.env.local.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

function carregarEnv(arquivo: string) {
  const caminho = path.resolve(__dirname, "..", arquivo);
  if (!fs.existsSync(caminho)) return;
  for (const linha of fs.readFileSync(caminho, "utf8").split("\n")) {
    const trimmed = linha.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const chave = trimmed.slice(0, eq).trim();
    let valor = trimmed.slice(eq + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}

carregarEnv(".env");
carregarEnv(".env.local");

function secretPlaceholder(valor: string | undefined): boolean {
  if (!valor) return true;
  return /xxx|preench|placeholder|sua-secret|service_role/i.test(valor);
}

function caminhoPdfCanonico(
  obraId: string,
  relatorioId: string,
  versaoNumero: number,
  sha256: string,
): string {
  return `${obraId}/${relatorioId}/v${versaoNumero}-${sha256}.pdf`;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || secretPlaceholder(secret)) {
    console.error(
      "SUPABASE_SECRET_KEY parece placeholder ou ausente — abortando.\n" +
        "Preencha a service role real em webapp/.env.local e rode novamente.",
    );
    process.exit(1);
  }

  const admin = createClient<Database>(url, secret!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // As duas RPCs abaixo são funções auxiliares temporárias deste backfill
  // (migration 20260905215435), removidas depois de usadas — não fazem
  // parte do Database gerado, daí o cast.
  const rpcTemp = admin.rpc.bind(admin) as unknown as (
    fn: "fn_listar_versoes_sem_pdf_hash" | "fn_backfill_pdf_versao",
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;

  console.log("=== 1. Verificando outras categorias de dados legados ===");

  const { data: acessosOrfaos } = await admin
    .from("obra_acessos")
    .select("id, obra_id, email")
    .is("owner_id", null);
  console.log("obra_acessos sem owner_id:", acessosOrfaos?.length ?? 0);
  if (acessosOrfaos?.length) console.log(JSON.stringify(acessosOrfaos, null, 2));

  const { data: atividadesOrfas } = await admin
    .from("atividades")
    .select("id, relatorio_id")
    .is("obra_id", null);
  console.log("atividades sem obra_id:", atividadesOrfas?.length ?? 0);
  if (atividadesOrfas?.length) console.log(JSON.stringify(atividadesOrfas, null, 2));

  const { data: relatoriosEnviados } = await admin
    .from("relatorios")
    .select("id, obra_id, snapshot")
    .eq("status", "enviado");
  const semSnapshot = (relatoriosEnviados ?? []).filter(
    (r) => !r.snapshot || JSON.stringify(r.snapshot) === "{}",
  );
  console.log("relatorios enviados sem snapshot:", semSnapshot.length);
  if (semSnapshot.length) console.log(JSON.stringify(semSnapshot, null, 2));

  const { data: fotos } = await admin
    .from("fotos")
    .select("id, obra_id, relatorio_id, etapa_id, storage_path");
  const cruzadas = (fotos ?? []).filter((f) => {
    const okObraRel = f.storage_path?.startsWith(`${f.obra_id}/${f.relatorio_id}/`);
    const okEtapa = f.storage_path?.includes(`/${f.etapa_id}/`);
    return !okObraRel || !okEtapa;
  });
  console.log("fotos com storage_path fora do padrão:", cruzadas.length);
  if (cruzadas.length) console.log(JSON.stringify(cruzadas, null, 2));

  const outrasPendencias =
    (acessosOrfaos?.length ?? 0) +
    (atividadesOrfas?.length ?? 0) +
    semSnapshot.length +
    cruzadas.length;

  console.log("\n=== 2. Backfill de pdf_sha256 em relatorio_versoes ===");

  const { data: versoes, error: versoesErr } = await rpcTemp(
    "fn_listar_versoes_sem_pdf_hash",
  );

  if (versoesErr) {
    console.error("Falha ao listar versões pendentes:", versoesErr.message);
    console.error(
      "(rode a migration 20260905215435_backfill_pdf_hash_fn.sql antes deste script)",
    );
    process.exit(1);
  }

  const lista = (versoes ?? []) as {
    id: string;
    relatorio_id: string;
    obra_id: string;
    numero: number;
    pdf_path: string;
  }[];

  console.log(`Encontradas ${lista.length} versão(ões) sem pdf_sha256.`);

  let corrigidas = 0;
  let falhas = 0;

  for (const v of lista) {
    console.log(`\n- versão ${v.id} (relatório ${v.relatorio_id}, v${v.numero})`);
    console.log(`  path atual: ${v.pdf_path}`);

    const { data: arquivo, error: downloadErr } = await admin.storage
      .from("pdfs")
      .download(v.pdf_path);

    if (downloadErr || !arquivo) {
      console.error(`  ✗ falha ao baixar PDF: ${downloadErr?.message}`);
      falhas++;
      continue;
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());
    const sha256 = createHash("sha256").update(buffer).digest("hex");
    const novoPath = caminhoPdfCanonico(v.obra_id, v.relatorio_id, v.numero, sha256);
    console.log(`  sha256: ${sha256}`);
    console.log(`  novo path: ${novoPath}`);

    if (novoPath !== v.pdf_path) {
      const { error: uploadErr } = await admin.storage
        .from("pdfs")
        .upload(novoPath, buffer, { contentType: "application/pdf", upsert: false });
      if (uploadErr) {
        const msg = uploadErr.message.toLowerCase();
        const jaExiste =
          msg.includes("already") || msg.includes("exists") || msg.includes("duplicate");
        if (!jaExiste) {
          console.error(`  ✗ falha ao copiar PDF para novo path: ${uploadErr.message}`);
          falhas++;
          continue;
        }
        console.log("  (novo path já existia — reaproveitando)");
      }
    }

    const { error: updateErr } = await rpcTemp("fn_backfill_pdf_versao", {
      p_versao_id: v.id,
      p_pdf_path: novoPath,
      p_sha256: sha256,
    });

    if (updateErr) {
      console.error(`  ✗ falha ao atualizar relatorio_versoes: ${updateErr.message}`);
      falhas++;
      continue;
    }

    console.log("  ✓ atualizado");
    corrigidas++;
  }

  console.log(`\n=== Resumo ===`);
  console.log(`versões corrigidas: ${corrigidas}`);
  console.log(`falhas: ${falhas}`);
  console.log(`outras pendências (não corrigidas automaticamente): ${outrasPendencias}`);

  if (falhas === 0 && outrasPendencias === 0) {
    console.log(
      "\nTudo certo. Agora rode a migration de limpeza para liberar o lockdown:\n" +
        "  webapp/supabase/migrations/20260905215436_backfill_legado_limpar.sql\n" +
        "e em seguida `supabase db push --linked`.",
    );
  } else {
    console.log(
      "\nAinda há pendências acima — revise antes de aplicar o security_lockdown.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
