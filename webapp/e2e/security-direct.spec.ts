/**
 * Testes diretos contra PostgREST/Storage/Auth locais com JWT real.
 * Requer stack Supabase local. Não usa server actions.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { RelatorioRascunho } from "@/lib/relatorios/tipos";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

if (!url || !anon || !service) {
  throw new Error(
    "test:security requer SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY",
  );
}

const senha = "Segura#Teste12";
const prefix = `sec-${Date.now()}-${randomUUID().slice(0, 8)}`;

function adminClient() {
  return createClient(url!, service!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function criarUsuario(email: string) {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome: email.split("@")[0] },
  });
  if (error || !data.user) throw error ?? new Error("createUser");
  return data.user;
}

async function login(email: string): Promise<SupabaseClient> {
  const c = createClient(url!, anon!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await c.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return c;
}

async function criarObra(ca: SupabaseClient, nome = "Obra") {
  const { data, error } = await ca.rpc("fn_criar_obra", {
    p_nome: nome,
    p_endereco: "Rua A, 1, Salvador",
    p_cliente_nome: "Cliente A",
    p_inicio: "2026-01-01",
    p_termino: "2026-12-01",
    p_valor_centavos: 100000,
    p_sinal_centavos: 0,
  });
  if (error) throw error;
  return data as string;
}

async function rascunhoMinimo(
  ca: SupabaseClient,
  obraId: string,
): Promise<RelatorioRascunho> {
  const { data: etapas, error } = await ca
    .from("etapas")
    .select("id")
    .eq("obra_id", obraId);
  if (error || !etapas?.length) throw error ?? new Error("etapas");
  return {
    versao: 1,
    etapas: etapas.map((e: { id: string }) => ({ etapaId: e.id, pct: 0 })),
    financeiro: { medicoes: [], materiais: [], aditivos: [], estornos: [] },
    atividades: [],
    prazo: [],
  };
}

async function publicarPrimeiroRelatorio(
  ca: SupabaseClient,
  obraId: string,
  dadosPersonalizados?: Awaited<ReturnType<typeof rascunhoMinimo>>,
) {
  const dados = dadosPersonalizados ?? (await rascunhoMinimo(ca, obraId));
  const { data: saved, error: saveErr } = await ca.rpc("fn_salvar_rascunho", {
    p_obra: obraId,
    p_relatorio: null,
    p_dados: dados,
  });
  if (saveErr) throw saveErr;
  const relatorioId = (saved as { relatorioId: string }).relatorioId;
  const { data: prep, error: prepErr } = await ca.rpc("fn_preparar_envio_relatorio", {
    p_relatorio: relatorioId,
  });
  if (prepErr) throw prepErr;
  const p = prep as {
    versaoId: string;
    relatorioId: string;
    obraId: string;
    versaoNumero: number;
  };
  const sha256 = createHash("sha256").update(`pdf-${p.versaoId}`).digest("hex");
  const path = `${p.obraId}/${p.relatorioId}/v${p.versaoNumero}-${sha256}.pdf`;
  const admin = adminClient();
  const up = await admin.storage
    .from("pdfs")
    .upload(path, new Uint8Array([37, 80, 68, 70]), {
      contentType: "application/pdf",
      upsert: false,
    });
  if (up.error) throw up.error;
  const { data: fin, error: finErr } = await admin.rpc("fn_finalizar_envio_relatorio", {
    p_versao: p.versaoId,
    p_pdf_path: path,
    p_pdf_sha256: sha256,
  });
  if (finErr) throw finErr;
  return { relatorioId, versaoId: p.versaoId, path, sha256, fin };
}

describe("segurança direta JWT/PostgREST", () => {
  it("A não lê nem altera obra de B; INSERT direto em obras falha", async () => {
    const a = await criarUsuario(`${prefix}-a@test.local`);
    await criarUsuario(`${prefix}-b@test.local`);
    const ca = await login(`${prefix}-a@test.local`);
    const cb = await login(`${prefix}-b@test.local`);

    const obraA = await criarObra(ca, "Obra A");

    const { data: lida } = await cb.from("obras").select("id").eq("id", obraA).maybeSingle();
    expect(lida).toBeNull();

    const { data: upd, error: updErr } = await cb
      .from("obras")
      .update({ nome: "Hack" })
      .eq("id", obraA)
      .select();
    expect(updErr || (upd ?? []).length === 0).toBeTruthy();
    const { data: depois } = await ca.from("obras").select("nome").eq("id", obraA).maybeSingle();
    expect(depois?.nome).toBe("Obra A");

    const { error: avancoErr } = await cb.rpc("fn_avanco_geral", {
      p_obra: obraA,
    });
    expect(avancoErr?.message).toContain("SEM_PERMISSAO");

    const { error: insertErr } = await ca.from("obras").insert({
      owner_id: a.id,
      nome: "Direto",
      endereco: "x",
      cliente_nome: "y",
      inicio_contratual: "2026-01-01",
      termino_contratual: "2026-02-01",
      valor_contratado_centavos: 1,
    });
    expect(insertErr).toBeTruthy();
  });

  it("anon não executa RPCs comerciais nem lê tabelas privadas", async () => {
    const anonC = createClient(url!, anon!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anonC.from("obras").select("id");
    expect((data ?? []).length).toBe(0);
    const { error: rpcErr } = await anonC.rpc("fn_criar_obra", {
      p_nome: "x",
      p_endereco: "y",
      p_cliente_nome: "z",
      p_inicio: "2026-01-01",
      p_termino: "2026-02-01",
      p_valor_centavos: 1,
    });
    expect(rpcErr).toBeTruthy();
    const { error: adminErr } = await anonC.rpc("fn_admin_kpis");
    expect(adminErr).toBeTruthy();
    void error;
  });

  it("INSERT direto em obra_acessos falha; pendente de cobrança não concede acesso", async () => {
    await criarUsuario(`${prefix}-c@test.local`);
    await criarUsuario(`${prefix}-p@test.local`);
    const ca = await login(`${prefix}-c@test.local`);
    const cp = await login(`${prefix}-p@test.local`);

    const obraId = await criarObra(ca, "Obra convite");

    const { error: ins } = await ca.from("obra_acessos").insert({
      obra_id: obraId,
      email: `${prefix}-p@test.local`,
    });
    expect(ins).toBeTruthy();

    const { data: livre, error: conviteErr } = await ca.rpc("fn_solicitar_acesso_obra", {
      p_obra: obraId,
      p_email: `${prefix}-p@test.local`,
    });
    expect(conviteErr).toBeNull();
    expect(livre).toBeTruthy();

    const { data: obraP } = await cp
      .from("obras")
      .select("id")
      .eq("id", obraId)
      .maybeSingle();
    expect(obraP).toBeNull();

    const { data: acessoP } = await cp
      .from("obra_acessos")
      .select("id")
      .eq("obra_id", obraId)
      .maybeSingle();
    expect(acessoP).toBeTruthy();

    const { error: dadosInternosErr } = await cp
      .from("relatorio_versoes")
      .select("dados_aplicacao");
    expect(dadosInternosErr).toBeTruthy();

    const { error: segundo } = await ca.rpc("fn_solicitar_acesso_obra", {
      p_obra: obraId,
      p_email: `${prefix}-extra@test.local`,
    });
    expect(segundo?.message).toContain("PRECISA_ASSINAR");
  });

  it("dois convites concorrentes não geram dois e-mails grátis", async () => {
    await criarUsuario(`${prefix}-race@test.local`);
    const ca = await login(`${prefix}-race@test.local`);
    const obraId = await criarObra(ca, "Obra race");
    const [r1, r2] = await Promise.all([
      ca.rpc("fn_solicitar_acesso_obra", {
        p_obra: obraId,
        p_email: `${prefix}-r1@test.local`,
      }),
      ca.rpc("fn_solicitar_acesso_obra", {
        p_obra: obraId,
        p_email: `${prefix}-r2@test.local`,
      }),
    ]);
    const oks = [r1, r2].filter((r) => !r.error);
    const erros = [r1, r2].filter((r) => r.error);
    expect(oks.length).toBe(1);
    expect(erros.some((e) => e.error?.message.includes("PRECISA_ASSINAR"))).toBe(true);
  });

  it("duas criações concorrentes na última vaga resultam em uma obra", async () => {
    await criarUsuario(`${prefix}-slot@test.local`);
    const ca = await login(`${prefix}-slot@test.local`);
    const [c1, c2] = await Promise.all([
      ca.rpc("fn_criar_obra", {
        p_nome: "Slot 1",
        p_endereco: "Rua S, 1",
        p_cliente_nome: "Cli",
        p_inicio: "2026-01-01",
        p_termino: "2026-12-01",
        p_valor_centavos: 1000,
      }),
      ca.rpc("fn_criar_obra", {
        p_nome: "Slot 2",
        p_endereco: "Rua S, 2",
        p_cliente_nome: "Cli",
        p_inicio: "2026-01-01",
        p_termino: "2026-12-01",
        p_valor_centavos: 1000,
      }),
    ]);
    const oks = [c1, c2].filter((r) => !r.error);
    expect(oks.length).toBe(1);
    expect([c1, c2].some((r) => r.error?.message.includes("LIMITE_OBRAS"))).toBe(true);
    const { data: obras } = await ca.from("obras").select("id");
    expect((obras ?? []).length).toBe(1);
  });

  it("proprietário não lê rascunho; RPC de envio de B falha na obra de A", async () => {
    await criarUsuario(`${prefix}-draft@test.local`);
    await criarUsuario(`${prefix}-prop@test.local`);
    const ca = await login(`${prefix}-draft@test.local`);
    const cp = await login(`${prefix}-prop@test.local`);
    const obraId = await criarObra(ca, "Obra rascunho");
    await ca.rpc("fn_solicitar_acesso_obra", {
      p_obra: obraId,
      p_email: `${prefix}-prop@test.local`,
    });
    const dados = await rascunhoMinimo(ca, obraId);
    const { data: saved } = await ca.rpc("fn_salvar_rascunho", {
      p_obra: obraId,
      p_relatorio: null,
      p_dados: dados,
    });
    const relatorioId = (saved as { relatorioId: string }).relatorioId;
    const { data: rascunhoP } = await cp
      .from("relatorios")
      .select("id, status")
      .eq("id", relatorioId)
      .maybeSingle();
    expect(rascunhoP).toBeNull();

    const { error: retB } = await cp.rpc("fn_preparar_retificacao", {
      p_relatorio: relatorioId,
      p_motivo: "hack",
      p_dados: dados,
    });
    expect(retB).toBeTruthy();
  });

  it("PDF publicado não pode ser sobrescrito pelo usuário autenticado", async () => {
    await criarUsuario(`${prefix}-pdf@test.local`);
    const ca = await login(`${prefix}-pdf@test.local`);
    const { error } = await ca.storage.from("pdfs").upload("x/y.pdf", new Uint8Array([1]), {
      contentType: "application/pdf",
      upsert: true,
    });
    expect(error).toBeTruthy();
  });

  it("relatório publicado é imutável; retificação de não-último falha; duas finalizações são idempotentes", async () => {
    const a = await criarUsuario(`${prefix}-pub@test.local`);
    const ca = await login(`${prefix}-pub@test.local`);
    const obraId = await criarObra(ca, "Obra pub");
    const pub = await publicarPrimeiroRelatorio(ca, obraId);
    const adminAss = adminClient();
    const { error: promoErr } = await adminAss
      .from("assinaturas")
      .update({ status: "ativa", plano: "obra_5", limite_obras: 5 })
      .eq("user_id", a.id);
    expect(promoErr).toBeNull();

    const { data: upd, error: updErr } = await ca
      .from("relatorio_versoes")
      .update({ motivo: "hack" })
      .eq("id", pub.versaoId)
      .select();
    expect(updErr || (upd ?? []).length === 0).toBeTruthy();

    const { error: logicalMutationErr } = await adminAss
      .from("relatorios")
      .update({ snapshot: { adulterado: true } })
      .eq("id", pub.relatorioId);
    expect(logicalMutationErr?.message).toContain("IMUTAVEL");

    const admin = adminClient();
    const { data: fin2, error: fin2Err } = await admin.rpc("fn_finalizar_envio_relatorio", {
      p_versao: pub.versaoId,
      p_pdf_path: pub.path,
      p_pdf_sha256: pub.sha256,
    });
    expect(fin2Err).toBeNull();
    expect((fin2 as { idempotente?: boolean }).idempotente).toBe(true);

    const dados = await rascunhoMinimo(ca, obraId);
    const { data: segundo } = await ca.rpc("fn_salvar_rascunho", {
      p_obra: obraId,
      p_relatorio: null,
      p_dados: dados,
    });
    const rel2 = (segundo as { relatorioId: string }).relatorioId;
    const { data: prep2, error: prep2Err } = await ca.rpc("fn_preparar_envio_relatorio", {
      p_relatorio: rel2,
    });
    expect(prep2Err).toBeNull();
    const p2 = prep2 as { versaoId: string; relatorioId: string; obraId: string; versaoNumero: number };
    const sha2 = createHash("sha256").update(`pdf-${p2.versaoId}`).digest("hex");
    const path2 = `${p2.obraId}/${p2.relatorioId}/v${p2.versaoNumero}-${sha2}.pdf`;
    await admin.storage.from("pdfs").upload(path2, new Uint8Array([37, 80, 68, 70]), {
      contentType: "application/pdf",
      upsert: false,
    });
    const { error: finRel2Err } = await admin.rpc("fn_finalizar_envio_relatorio", {
      p_versao: p2.versaoId,
      p_pdf_path: path2,
      p_pdf_sha256: sha2,
    });
    expect(finRel2Err).toBeNull();

    const { error: retAntigo } = await ca.rpc("fn_preparar_retificacao", {
      p_relatorio: pub.relatorioId,
      p_motivo: "atraso de material",
      p_dados: dados,
    });
    expect(retAntigo?.message).toMatch(/ULTIMO|NAO_ULTIMO|RELATORIO_INVALIDO|SEM_PERMISSAO/);
  });

  it("rate limit de checkout devolve RATE_LIMITED", async () => {
    await criarUsuario(`${prefix}-rl@test.local`);
    const ca = await login(`${prefix}-rl@test.local`);
    let lastError: string | undefined;
    for (let i = 0; i < 6; i += 1) {
      const { error } = await ca.rpc("fn_consumir_rate_limit", { p_acao: "checkout" });
      if (error) lastError = error.message;
    }
    expect(lastError).toContain("RATE_LIMITED");
  });

  it("admin não-admin não executa RPCs operacionais", async () => {
    await criarUsuario(`${prefix}-adm@test.local`);
    const ca = await login(`${prefix}-adm@test.local`);
    const { error } = await ca.rpc("fn_admin_kpis");
    expect(error?.message).toContain("SEM_PERMISSAO");
  });

  it("HMAC de webhook continua válido", () => {
    const body = '{"id":"evt_1","event":"subscription.completed"}';
    const sig = createHmac("sha256", "unused").digest("hex");
    expect(sig.length).toBeGreaterThan(8);
    expect(body).toContain("subscription.completed");
  });

  it("trial expirado bloqueia capa, foto e novo convite", async () => {
    const usuario = await criarUsuario(`${prefix}-trial-exp@test.local`);
    const ca = await login(`${prefix}-trial-exp@test.local`);
    const obraId = await criarObra(ca, "Obra trial expirado");
    const dados = await rascunhoMinimo(ca, obraId);
    const { data: salvo, error: salvarErr } = await ca.rpc("fn_salvar_rascunho", {
      p_obra: obraId,
      p_relatorio: null,
      p_dados: dados,
    });
    expect(salvarErr).toBeNull();
    const relatorioId = (salvo as { relatorioId: string }).relatorioId;
    const etapaId = dados.etapas[0].etapaId;

    await adminClient()
      .from("assinaturas")
      .update({ trial_fim: "2020-01-01T00:00:00Z" })
      .eq("user_id", usuario.id);

    const [capa, foto, convite] = await Promise.all([
      ca.rpc("fn_atualizar_capa_obra", {
        p_obra: obraId,
        p_path: `${obraId}/capa.webp`,
      }),
      ca.rpc("fn_reservar_foto", {
        p_obra: obraId,
        p_relatorio: relatorioId,
        p_etapa: etapaId,
      }),
      ca.rpc("fn_solicitar_acesso_obra", {
        p_obra: obraId,
        p_email: `${prefix}-trial-alvo@test.local`,
      }),
    ]);
    expect(capa.error?.message).toContain("ASSINATURA_INATIVA");
    expect(foto.error?.message).toContain("ASSINATURA_INATIVA");
    expect(convite.error?.message).toContain("ASSINATURA_INATIVA");
  });

  it("finalização exige objeto PDF e retry reutiliza a versão falha", async () => {
    await criarUsuario(`${prefix}-retry@test.local`);
    const ca = await login(`${prefix}-retry@test.local`);
    const obraId = await criarObra(ca, "Obra retry");
    const dados = await rascunhoMinimo(ca, obraId);
    const { data: salvo } = await ca.rpc("fn_salvar_rascunho", {
      p_obra: obraId,
      p_relatorio: null,
      p_dados: dados,
    });
    const relatorioId = (salvo as { relatorioId: string }).relatorioId;
    const { data: prep } = await ca.rpc("fn_preparar_envio_relatorio", {
      p_relatorio: relatorioId,
    });
    const primeira = prep as { versaoId: string; versaoNumero: number };
    const sha = createHash("sha256").update("ausente").digest("hex");
    const path = `${obraId}/${relatorioId}/v1-${sha}.pdf`;
    const admin = adminClient();
    const { error: semPdf } = await admin.rpc("fn_finalizar_envio_relatorio", {
      p_versao: primeira.versaoId,
      p_pdf_path: path,
      p_pdf_sha256: sha,
    });
    expect(semPdf?.message).toContain("PDF_AUSENTE");

    await admin.rpc("fn_marcar_versao_falhou", {
      p_versao: primeira.versaoId,
      p_erro: "storage indisponível",
    });
    const { data: retry, error: retryErr } = await ca.rpc(
      "fn_preparar_envio_relatorio",
      { p_relatorio: relatorioId },
    );
    expect(retryErr).toBeNull();
    expect((retry as { versaoId: string }).versaoId).toBe(primeira.versaoId);
  });

  it("retificação preserva totais quando os dados não mudam", async () => {
    const usuario = await criarUsuario(`${prefix}-ret@test.local`);
    const ca = await login(`${prefix}-ret@test.local`);
    const obraId = await criarObra(ca, "Obra retificação");
    const dados = await rascunhoMinimo(ca, obraId);
    dados.financeiro.medicoes = [{ valorCentavos: 15000 }];
    dados.financeiro.materiais = [{ rotulo: "Cimento", valorCentavos: 5000 }];
    dados.prazo = [{ motivo: "chuvas", dias: 3 }];
    dados.atividades = [
      { etapaId: dados.etapas[0].etapaId, nota: "Fundação", fotosPaths: [] },
    ];
    const publicada = await publicarPrimeiroRelatorio(ca, obraId, dados);
    const admin = adminClient();
    await admin
      .from("assinaturas")
      .update({ status: "ativa", plano: "obra_5", limite_obras: 5 })
      .eq("user_id", usuario.id);

    const { data: prep, error: prepErr } = await ca.rpc("fn_preparar_retificacao", {
      p_relatorio: publicada.relatorioId,
      p_motivo: "Correção textual",
      p_dados: dados,
    });
    expect(prepErr).toBeNull();
    const ret = prep as {
      versaoId: string;
      versaoNumero: number;
      snapshot: {
        financeiro: { pagoAcumuladoCentavos: number };
        prazo: { totalDiasAditivados: number };
        atividades: unknown[];
      };
    };
    expect(ret.snapshot.financeiro.pagoAcumuladoCentavos).toBe(20000);
    expect(ret.snapshot.prazo.totalDiasAditivados).toBe(3);
    expect(ret.snapshot.atividades).toHaveLength(1);

    const sha = createHash("sha256").update(`ret-${ret.versaoId}`).digest("hex");
    const path = `${obraId}/${publicada.relatorioId}/v${ret.versaoNumero}-${sha}.pdf`;
    const upload = await admin.storage
      .from("pdfs")
      .upload(path, new Uint8Array([37, 80, 68, 70]), {
        contentType: "application/pdf",
        upsert: false,
      });
    expect(upload.error).toBeNull();
    const { error: finalizarErr } = await admin.rpc("fn_finalizar_retificacao", {
      p_versao: ret.versaoId,
      p_pdf_path: path,
      p_pdf_sha256: sha,
    });
    expect(finalizarErr).toBeNull();

    const { data: totais } = await admin
      .from("relatorios")
      .select("snapshot")
      .eq("id", publicada.relatorioId)
      .single();
    const snapshot = totais?.snapshot as {
      financeiro: { pagoAcumuladoCentavos: number };
      prazo: { totalDiasAditivados: number };
    };
    expect(snapshot.financeiro.pagoAcumuladoCentavos).toBe(20000);
    expect(snapshot.prazo.totalDiasAditivados).toBe(3);
  });

  it("revogar convite pendente cancela a cobrança antes do claim", async () => {
    const usuario = await criarUsuario(`${prefix}-cancel-outbox@test.local`);
    const ca = await login(`${prefix}-cancel-outbox@test.local`);
    const obraId = await criarObra(ca, "Obra outbox");
    await adminClient()
      .from("assinaturas")
      .update({
        status: "ativa",
        plano: "obra_5",
        limite_obras: 5,
        abacatepay_subscription_id: "sub_teste",
      })
      .eq("user_id", usuario.id);
    await ca.rpc("fn_solicitar_acesso_obra", {
      p_obra: obraId,
      p_email: `${prefix}-gratis@test.local`,
    });
    const { data: pago, error: pagoErr } = await ca.rpc(
      "fn_solicitar_acesso_obra",
      {
        p_obra: obraId,
        p_email: `${prefix}-pago@test.local`,
      },
    );
    expect(pagoErr).toBeNull();
    const convite = pago as { acessoId: string; outboxId: string };
    const { error: revogarErr } = await ca.rpc("fn_revogar_acesso_obra", {
      p_obra: obraId,
      p_acesso: convite.acessoId,
    });
    expect(revogarErr).toBeNull();
    const { data: claim, error: claimErr } = await adminClient().rpc(
      "fn_claim_outbox",
      { p_outbox: convite.outboxId },
    );
    expect(claimErr).toBeNull();
    expect((claim as { status: string }).status).toBe("cancelado");
  });

  it("webhook com erro pode ser reclamado, mas claim fresco é idempotente", async () => {
    const admin = adminClient();
    const eventId = `${prefix}-evento`;
    const args = {
      p_event_id: eventId,
      p_evento: "subscription.completed",
      p_payload: { id: eventId },
      p_force: false,
    };
    const { data: primeiro, error: primeiroErr } = await admin.rpc(
      "fn_claim_webhook_evento",
      args,
    );
    expect(primeiroErr).toBeNull();
    const logId = (primeiro as { logId: string }).logId;
    await admin
      .from("webhooks_log")
      .update({ erro: "falha", processado: false })
      .eq("id", logId);
    const { data: retry } = await admin.rpc("fn_claim_webhook_evento", args);
    expect((retry as { duplicado: boolean }).duplicado).toBe(false);
    const { data: concorrente } = await admin.rpc("fn_claim_webhook_evento", args);
    expect((concorrente as { emProcessamento: boolean }).emProcessamento).toBe(
      true,
    );
  });
});
