/**
 * Spike E0 (plano da tela de Cobrança): explora o AbacatePay em dev mode.
 * Roda só com a chave de dev mode no .env.local; nunca imprime segredos.
 *
 * Uso:
 *   npm run spike:abacatepay -- checkout <externalId> [productKey] [cust_id]   cria cliente (ou reusa cust_id) + checkout de assinatura
 *   npm run spike:abacatepay -- assinaturas                          lista assinaturas
 *   npm run spike:abacatepay -- cancelar <subs_id>                   cancela uma assinatura
 *   npm run spike:abacatepay -- produto-trial <dias>                 cria produto da obra com trialDays
 *
 * productKey: "obra" (padrão, ABACATEPAY_PROD_OBRA_ATIVA) ou o ID de um produto.
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
    let valor = t.slice(eq + 1).trim();
    if (/^(".*"|'.*')$/.test(valor)) valor = valor.slice(1, -1);
    if (process.env[chave] === undefined) process.env[chave] = valor;
  }
}
carregarEnv(".env");
carregarEnv(".env.local");

const BASE = "https://api.abacatepay.com/v2";
const KEY = process.env.ABACATEPAY_API_KEY ?? "";
if (!KEY.startsWith("abc_dev_")) {
  console.error("ABACATEPAY_API_KEY não é uma chave de dev mode (abc_dev_…). Abortando.");
  process.exit(1);
}

async function api(method: "GET" | "POST", rota: string, corpo?: unknown) {
  const res = await fetch(`${BASE}${rota}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await res.text();
  let json: unknown = texto;
  try {
    json = JSON.parse(texto);
  } catch {
    /* mantém texto */
  }
  return { status: res.status, json };
}

function mostrar(titulo: string, valor: unknown) {
  console.log(`\n== ${titulo}`);
  console.log(JSON.stringify(valor, null, 2));
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  if (cmd === "checkout") {
    const externalId = a ?? `spike-${Date.now()}`;
    const productId =
      !b || b === "obra" ? process.env.ABACATEPAY_PROD_OBRA_ATIVA : b;
    if (!productId) throw new Error("ABACATEPAY_PROD_OBRA_ATIVA ausente");

    let customerId: string | undefined = c;
    if (!customerId) {
      const cliente = await api("POST", "/customers/create", {
        email: "programacao@arcaed.com.br",
        name: "Teste Spike E0",
        metadata: { spike: true },
      });
      mostrar("customers/create", cliente);
      customerId = (cliente.json as { data?: { id?: string } })?.data?.id;
    }
    if (!customerId) throw new Error("cliente não criado");

    const checkout = await api("POST", "/subscriptions/create", {
      items: [{ id: productId, quantity: 1 }],
      customerId,
      externalId,
      methods: ["CARD"],
      retryPolicy: { maxRetry: 7, retryEvery: 2 },
      metadata: { spike: true, obraId: externalId },
      returnUrl: `${appUrl}/obras`,
      completionUrl: `${appUrl}/obras?spike=1`,
    });
    mostrar("subscriptions/create", checkout);
    const url = (checkout.json as { data?: { url?: string } })?.data?.url;
    if (url) console.log(`\nCHECKOUT: ${url}`);
    return;
  }

  if (cmd === "assinaturas") {
    mostrar("subscriptions/list", await api("GET", "/subscriptions/list"));
    return;
  }

  if (cmd === "cancelar") {
    if (!a) throw new Error("informe o id da assinatura");
    mostrar("subscriptions/cancel", await api("POST", "/subscriptions/cancel", { id: a }));
    return;
  }

  if (cmd === "produto-trial") {
    const dias = Number(a);
    if (!Number.isInteger(dias) || dias < 1) throw new Error("informe os dias (inteiro >= 1)");
    mostrar(
      "products/create (trialDays)",
      await api("POST", "/products/create", {
        externalId: `obra-ativa-v2-td${dias}`,
        name: `Como Esta Minha Obra — Obra ativa (primeira cobrança em ${dias} dias)`,
        price: 12990,
        currency: "BRL",
        cycle: "MONTHLY",
        trialDays: dias,
      }),
    );
    return;
  }

  console.error("Comando inválido. Veja o cabeçalho do arquivo.");
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
