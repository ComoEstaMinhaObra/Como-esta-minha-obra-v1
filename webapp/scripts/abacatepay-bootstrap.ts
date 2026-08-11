/**
 * Bootstrap idempotente dos produtos AbacatePay (S4.2).
 * Uso: npm run abacatepay:bootstrap
 * Nao roda contra API real se ABACATEPAY_API_KEY for placeholder.
 */
import fs from "node:fs";
import path from "node:path";

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

async function main() {
  const { PLANOS, EMAIL_EXTRA } = await import("../src/config/pricing");
  const { criarProduto, listarProdutos } = await import(
    "../src/lib/abacatepay"
  );

  const apiKey = process.env.ABACATEPAY_API_KEY;
  if (!apiKey || /xxx|preench|placeholder|abc_dev_xxx/i.test(apiKey)) {
    console.error(
      "ABACATEPAY_API_KEY parece placeholder — abortando bootstrap (sem chamada a API).",
    );
    process.exit(1);
  }

  const resultados: Record<string, string> = {};

  for (const plano of PLANOS) {
    const existentes = await listarProdutos({
      externalId: plano.externalId,
      limit: 10,
    });
    const achado = (existentes ?? []).find(
      (p) => p.externalId === plano.externalId,
    );
    const p =
      achado ??
      (await criarProduto({
        externalId: plano.externalId,
        name: `Como Esta Minha Obra — ${plano.nome}`,
        price: plano.precoCentavos,
        currency: "BRL",
        cycle: "MONTHLY",
      }));
    console.log(`${achado ? "✓" : "+"} ${plano.externalId} → ${p.id}`);
    const envKey =
      plano.id === "obra_1"
        ? "ABACATEPAY_PROD_OBRA_1"
        : plano.id === "obra_3"
          ? "ABACATEPAY_PROD_OBRA_3"
          : "ABACATEPAY_PROD_OBRA_5";
    resultados[envKey] = p.id;
  }

  const existentesEmail = await listarProdutos({
    externalId: EMAIL_EXTRA.externalId,
    limit: 10,
  });
  const achadoEmail = (existentesEmail ?? []).find(
    (p) => p.externalId === EMAIL_EXTRA.externalId,
  );
  const email =
    achadoEmail ??
    (await criarProduto({
      externalId: EMAIL_EXTRA.externalId,
      name: `Como Esta Minha Obra — ${EMAIL_EXTRA.nome}`,
      price: EMAIL_EXTRA.precoCentavos,
      currency: "BRL",
    }));
  console.log(
    `${achadoEmail ? "✓" : "+"} ${EMAIL_EXTRA.externalId} → ${email.id}`,
  );
  resultados.ABACATEPAY_PROD_EMAIL_EXTRA = email.id;

  console.log("\nPreencha no .env.local / Vercel:\n");
  for (const [k, v] of Object.entries(resultados)) {
    console.log(`${k}=${v}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
