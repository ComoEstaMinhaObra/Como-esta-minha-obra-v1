/**
 * Bootstrap idempotente dos produtos AbacatePay (cobrança por obra).
 * Uso: npm run abacatepay:bootstrap
 * Cria no ambiente da ABACATEPAY_API_KEY (chave de dev mode = produtos de dev mode;
 * chave de produção = produtos de produção; os ambientes são separados).
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
  const { OBRA_ATIVA, EMAIL_ADICIONAL } = await import(
    "../src/config/pricing"
  );
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

  async function garantirProduto(
    externalId: string,
    nome: string,
    precoCentavos: number,
    cycle?: "MONTHLY",
  ) {
    const existentes = await listarProdutos({ externalId, limit: 10 });
    const achado = (existentes ?? []).find((p) => p.externalId === externalId);
    const produto =
      achado ??
      (await criarProduto({
        externalId,
        name: `Como Esta Minha Obra — ${nome}`,
        price: precoCentavos,
        currency: "BRL",
        ...(cycle ? { cycle } : {}),
      }));
    console.log(`${achado ? "✓" : "+"} ${externalId} → ${produto.id}`);
    return produto;
  }

  // Cobrança por obra (decisões de 28/09 e 01/10/2026): um produto mensal por obra ativa
  // (uma assinatura por obra, quantity 1) e o e-mail adicional avulso (sem ciclo).
  const obra = await garantirProduto(
    OBRA_ATIVA.externalId,
    OBRA_ATIVA.nome,
    OBRA_ATIVA.precoCentavos,
    "MONTHLY",
  );
  resultados.ABACATEPAY_PROD_OBRA_ATIVA = obra.id;

  const email = await garantirProduto(
    EMAIL_ADICIONAL.externalId,
    EMAIL_ADICIONAL.nome,
    EMAIL_ADICIONAL.precoCentavos,
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
