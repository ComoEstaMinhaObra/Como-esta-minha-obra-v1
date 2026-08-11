import fs from "node:fs";
import path from "node:path";
import { vi } from "vitest";

/** server-only lança em testes; noop no Vitest. */
vi.mock("server-only", () => ({}));

/** Carrega .env.local / .env para testes (sem dependência extra). */
function carregarEnv(arquivo: string) {
  const caminho = path.resolve(process.cwd(), arquivo);
  if (!fs.existsSync(caminho)) return;
  const conteudo = fs.readFileSync(caminho, "utf8");
  for (const linha of conteudo.split("\n")) {
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
    if (process.env[chave] === undefined) {
      process.env[chave] = valor;
    }
  }
}

carregarEnv(".env");
carregarEnv(".env.local");
