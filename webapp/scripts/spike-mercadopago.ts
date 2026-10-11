/**
 * Spike do plano de migração para o Mercado Pago: explora a API com credenciais de TESTE e
 * imprime as respostas cruas para decidir os pontos "SPIKE" de src/lib/mercadopago.ts.
 * Lê .env.staging.local (nunca .env.local, que aponta para produção). Recusa token que não seja de
 * usuário de teste.
 *
 *   npm run spike:mercadopago -- eu
 *   npm run spike:mercadopago -- pendente <emailComprador> [diasTrial]      opção A: init_point hospedado
 *   npm run spike:mercadopago -- cartao <emailComprador> [diasTrial] [nome] opção B: token de teste + authorized
 *   npm run spike:mercadopago -- ver <preapprovalId>
 *   npm run spike:mercadopago -- parcelas <preapprovalId>
 *   npm run spike:mercadopago -- valor <preapprovalId> <reais>
 *   npm run spike:mercadopago -- cancelar <preapprovalId>
 *   npm run spike:mercadopago -- trocar-cartao <preapprovalId> [nome]
 *   npm run spike:mercadopago -- notificacoes                                 lista as entregas de webhook recentes
 *
 * Cartão de teste (BR, documentação oficial): Mastercard 5031 4332 1540 6351, CVV 123, 11/2030;
 * titular APRO = aprovado, OTHE = recusa genérica, FUND = saldo insuficiente.
 */
import fs from "node:fs";
import path from "node:path";

function carregarEnv(arquivo: string) {
  const caminho = path.resolve(__dirname, "..", arquivo);
  if (!fs.existsSync(caminho)) return;
  for (const linha of fs.readFileSync(caminho, "utf8").split("\n")) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const chave = t.slice(0, eq).trim();
    const valor = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}
carregarEnv(".env.staging.local");

const BASE = "https://api.mercadopago.com";
const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN ?? "";
const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";

async function api(method: string, rota: string, corpo?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${rota}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      ...(method !== "GET" ? { "X-Idempotency-Key": crypto.randomUUID() } : {}),
      ...extra,
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await res.text();
  let json: unknown = texto;
  try {
    json = JSON.parse(texto);
  } catch {
    /* corpo não JSON */
  }
  console.log(`\n${method} ${rota} -> HTTP ${res.status}`);
  console.log(JSON.stringify(json, null, 2));
  return { status: res.status, json: json as Record<string, unknown> };
}

async function exigirTeste() {
  const res = await fetch(`${BASE}/users/me`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  const me = (await res.json()) as { tags?: string[]; id?: number; site_id?: string };
  if (!me.tags?.includes("test_user")) {
    console.error("O token não é de usuário de teste (tag test_user ausente). Abortando.");
    process.exit(1);
  }
  return me;
}

/** Tokeniza um cartão de teste no servidor (só para o spike; o app real tokeniza no navegador). */
async function tokenizarCartaoTeste(nome: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/card_tokens?public_key=${encodeURIComponent(PUBLIC_KEY)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      card_number: process.env.SPIKE_CARD ?? "5031433215406351",
      security_code: "123",
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: nome, identification: { type: "CPF", number: "12345678909" } },
    }),
  });
  const json = (await res.json()) as { id?: string };
  console.log(`\nPOST /v1/card_tokens -> HTTP ${res.status} (token ${json.id ? "gerado" : "NÃO gerado"})`);
  if (!json.id) {
    console.log(JSON.stringify(json, null, 2));
    process.exit(1);
  }
  return json.id;
}

function corpoAssinatura(email: string, dias: number | undefined, extra: Record<string, unknown>) {
  return {
    reason: "CEMO spike: obra ativa",
    external_reference: `spike-${Date.now()}`,
    payer_email: email,
    back_url: `${APP_URL.replace(/\/$/, "")}/cobranca`,
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: 129.9,
      currency_id: "BRL",
      ...(dias ? { free_trial: { frequency: dias, frequency_type: "days" } } : {}),
    },
    ...extra,
  };
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  if (!TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente em .env.staging.local");
  const me = await exigirTeste();

  switch (cmd) {
    case "eu":
      console.log("Vendedor de teste:", me.id, me.site_id);
      return;
    case "pendente": {
      if (!a) throw new Error("uso: pendente <emailComprador> [diasTrial]");
      await api("POST", "/preapproval", corpoAssinatura(a, b ? Number(b) : undefined, { status: "pending" }));
      return;
    }
    case "cartao": {
      if (!a) throw new Error("uso: cartao <emailComprador> [diasTrial] [nome]");
      const token = await tokenizarCartaoTeste(c ?? "APRO");
      await api(
        "POST",
        "/preapproval",
        corpoAssinatura(a, b && b !== "-" ? Number(b) : undefined, { status: "authorized", card_token_id: token }),
      );
      return;
    }
    case "ver":
      await api("GET", `/preapproval/${a}`);
      return;
    case "parcelas":
      await api("GET", `/authorized_payments/search?preapproval_id=${a}`);
      return;
    case "valor":
      await api("PUT", `/preapproval/${a}`, {
        auto_recurring: { transaction_amount: Number(b), currency_id: "BRL" },
      });
      return;
    case "cancelar":
      await api("PUT", `/preapproval/${a}`, { status: "cancelled" });
      return;
    case "trocar-cartao": {
      const token = await tokenizarCartaoTeste(b ?? "APRO");
      await api("PUT", `/preapproval/${a}`, { card_token_id: token });
      return;
    }
    case "notificacoes":
      await api("GET", "/v1/webhooks?limit=20");
      return;
    default:
      console.log("comando desconhecido; veja o cabeçalho do arquivo.");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
