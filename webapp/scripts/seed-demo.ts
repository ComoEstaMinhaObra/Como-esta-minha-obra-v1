/**
 * Seed de demonstração — Residência de Francisco (S5.6).
 * Uso: npm run seed:demo
 * Requer SUPABASE_SECRET_KEY real (não placeholder).
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  DEMO_FRANCISCO,
  expectativasFinanceirasFrancisco,
} from "../src/lib/demo/francisco";
import { ETAPAS_PADRAO } from "../src/lib/obras/etapas";
import { calcularAvancoGeral } from "../src/lib/relatorios/calculos";
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || secretPlaceholder(secret)) {
    console.error(
      "SUPABASE_SECRET_KEY parece placeholder ou ausente — abortando seed:demo.\n" +
        "Preencha a service role real em webapp/.env.local e rode novamente.",
    );
    process.exit(1);
  }

  const admin = createClient<Database>(url, secret!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const exp = expectativasFinanceirasFrancisco();
  console.log("Expectativas financeiras:", {
    contratadoTotal: exp.contratadoTotalCentavos,
    pago: exp.pagoAcumuladoCentavos,
    pct: exp.pctPago,
    saldo: exp.saldoCentavos,
    termino: exp.terminoPrevisto,
  });

  // Usuário demo (idempotente por e-mail)
  const email = DEMO_FRANCISCO.email;
  let userId: string | null = null;

  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existente = (list.data.users ?? []).find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (existente) {
    userId = existente.id;
    console.log("✓ usuário demo existente", userId);
  } else {
    const criado = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nome: DEMO_FRANCISCO.nomeEmpreiteiro },
    });
    if (criado.error || !criado.data.user) {
      console.error("Falha ao criar usuário:", criado.error?.message);
      process.exit(1);
    }
    userId = criado.data.user.id;
    console.log("+ usuário demo criado", userId);
  }

  await admin
    .from("profiles")
    .update({ nome: DEMO_FRANCISCO.nomeEmpreiteiro })
    .eq("id", userId);

  await admin
    .from("assinaturas")
    .update({
      status: "ativa",
      plano: "obra_1",
      limite_obras: 1,
      atualizado_em: new Date().toISOString(),
    })
    .eq("user_id", userId);

  // Remove obra demo anterior (cascade)
  const { data: obrasAntigas } = await admin
    .from("obras")
    .select("id")
    .eq("owner_id", userId)
    .eq("nome", DEMO_FRANCISCO.obraNome);

  for (const o of obrasAntigas ?? []) {
    await admin.from("obras").delete().eq("id", o.id);
  }

  const { data: obra, error: obraErr } = await admin
    .from("obras")
    .insert({
      owner_id: userId,
      nome: DEMO_FRANCISCO.obraNome,
      endereco: DEMO_FRANCISCO.endereco,
      cliente_nome: DEMO_FRANCISCO.clienteNome,
      construtora: "Construtora Demo",
      engenheiro: "Eng. Demo",
      inicio_contratual: DEMO_FRANCISCO.inicioContratual,
      termino_contratual: DEMO_FRANCISCO.terminoContratual,
      valor_contratado_centavos: DEMO_FRANCISCO.valorContratadoCentavos,
      sinal_centavos: DEMO_FRANCISCO.sinalCentavos,
      lat: -12.9714,
      lng: -38.5014,
    })
    .select("id")
    .single();

  if (obraErr || !obra) {
    console.error("Falha ao criar obra:", obraErr?.message);
    process.exit(1);
  }

  const etapasInsert = ETAPAS_PADRAO.map((nome, i) => ({
    obra_id: obra.id,
    nome,
    ordem: i + 1,
    peso: 1,
    pct_atual: DEMO_FRANCISCO.pctEtapas[i] ?? 0,
  }));

  const { data: etapas, error: etapasErr } = await admin
    .from("etapas")
    .insert(etapasInsert)
    .select("id, nome, ordem, pct_atual, peso");

  if (etapasErr || !etapas) {
    console.error("Falha ao criar etapas:", etapasErr?.message);
    process.exit(1);
  }

  const etapasOrdenadas = [...etapas].sort((a, b) => a.ordem - b.ordem);
  const avanco = calcularAvancoGeral(
    etapasOrdenadas.map((e) => ({
      peso: Number(e.peso),
      pct: e.pct_atual,
    })),
  );

  // 3 relatórios enviados com lançamentos acumulados
  const relatorioIds: string[] = [];

  for (let n = 1; n <= 3; n++) {
    const geralAntes = n === 1 ? 0 : Math.round(avanco * ((n - 1) / 3));
    const geralDepois = n === 3 ? avanco : Math.round(avanco * (n / 3));

    const snapshot = {
      versao: 1 as const,
      numero: n,
      enviadoEm: new Date(
        Date.now() - (4 - n) * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      obra: {
        nome: DEMO_FRANCISCO.obraNome,
        clienteNome: DEMO_FRANCISCO.clienteNome,
        endereco: DEMO_FRANCISCO.endereco,
        construtora: "Construtora Demo",
        engenheiro: "Eng. Demo",
        inicioContratual: DEMO_FRANCISCO.inicioContratual,
        terminoContratual: DEMO_FRANCISCO.terminoContratual,
      },
      avancoFisico: {
        geralAntes,
        geralDepois,
        etapas: etapasOrdenadas.map((e) => ({
          nome: e.nome,
          peso: Number(e.peso),
          pctAnterior: n === 1 ? 0 : e.pct_atual,
          pctNovo: e.pct_atual,
        })),
      },
      financeiro: {
        valorContratadoCentavos: DEMO_FRANCISCO.valorContratadoCentavos,
        aditivosAcumuladoCentavos: exp.aditivosAcumuladoCentavos,
        contratadoTotalCentavos: exp.contratadoTotalCentavos,
        pagoAcumuladoCentavos: exp.pagoAcumuladoCentavos,
        pctPago: exp.pctPago,
        saldoCentavos: exp.saldoCentavos,
        lancamentosNovos: [],
      },
      prazo: {
        novosDias:
          n === 3
            ? DEMO_FRANCISCO.diasAditivados.map((d) => ({
                motivo: d.motivo,
                descricao: d.descricao,
                dias: d.dias,
              }))
            : [],
        totalDiasAditivados: n === 3 ? 30 : 0,
        novaDataTermino:
          n === 3 ? exp.terminoPrevisto : DEMO_FRANCISCO.terminoContratual,
      },
      atividades: [],
      clima: { dias: [] },
    };

    const { data: rel, error: relErr } = await admin
      .from("relatorios")
      .insert({
        obra_id: obra.id,
        numero: n,
        status: "enviado",
        snapshot,
        geral_antes: geralAntes,
        geral_depois: geralDepois,
        enviado_em: snapshot.enviadoEm,
      })
      .select("id")
      .single();

    if (relErr || !rel) {
      console.error(`Falha relatório ${n}:`, relErr?.message);
      process.exit(1);
    }
    relatorioIds.push(rel.id);

    // pct por etapa no relatório
    await admin.from("relatorio_etapas").insert(
      etapasOrdenadas.map((e) => ({
        relatorio_id: rel.id,
        etapa_id: e.id,
        pct: e.pct_atual,
      })),
    );
  }

  const r1 = relatorioIds[0]!;
  const r2 = relatorioIds[1]!;
  const r3 = relatorioIds[2]!;

  // Sinal no 1º
  await admin.from("lancamentos").insert({
    obra_id: obra.id,
    relatorio_id: r1,
    tipo: "sinal",
    grupo: "medicoes",
    numero: null,
    rotulo: "Sinal",
    valor_centavos: DEMO_FRANCISCO.sinalCentavos,
  });

  // Medições 01–03
  for (let i = 0; i < DEMO_FRANCISCO.medicoesCentavos.length; i++) {
    const relId = relatorioIds[i]!;
    await admin.from("lancamentos").insert({
      obra_id: obra.id,
      relatorio_id: relId,
      tipo: "medicao",
      grupo: "medicoes",
      numero: i + 1,
      rotulo: `Medição ${String(i + 1).padStart(2, "0")}`,
      valor_centavos: DEMO_FRANCISCO.medicoesCentavos[i]!,
    });
  }

  // Materiais no 2º e 3º
  const mats = DEMO_FRANCISCO.materiais;
  for (let i = 0; i < mats.length; i++) {
    const m = mats[i]!;
    await admin.from("lancamentos").insert({
      obra_id: obra.id,
      relatorio_id: i < 2 ? r2 : r3,
      tipo: "material",
      grupo: "materiais",
      numero: i + 1,
      rotulo: m.rotulo,
      valor_centavos: m.valorCentavos,
    });
  }

  // Aditivos no 3º
  for (let i = 0; i < DEMO_FRANCISCO.aditivosCentavos.length; i++) {
    await admin.from("lancamentos").insert({
      obra_id: obra.id,
      relatorio_id: r3,
      tipo: "aditivo",
      grupo: "aditivos",
      numero: i + 1,
      rotulo: `Aditivo ${String(i + 1).padStart(2, "0")}`,
      valor_centavos: DEMO_FRANCISCO.aditivosCentavos[i]!,
    });
  }

  // Dias aditivados no 3º
  for (const d of DEMO_FRANCISCO.diasAditivados) {
    await admin.from("dias_aditivados").insert({
      obra_id: obra.id,
      relatorio_id: r3,
      motivo: d.motivo,
      descricao: d.descricao,
      dias: d.dias,
    });
  }

  console.log("✓ Seed concluído");
  console.log({
    userId,
    email,
    obraId: obra.id,
    relatorios: relatorioIds.length,
    avancoGeral: avanco,
    terminoPrevisto: exp.terminoPrevisto,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
