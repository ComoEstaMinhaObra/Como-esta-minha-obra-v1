import "server-only";

const PROIBIDOS =
  /email|e-mail|senha|password|token|secret|authorization|bearer|api[_-]?key|assinad|snapshot|payload|stack|sqlstate/gi;

export type LogSeguro = {
  evento: string;
  correlationId?: string;
  status?: string | number;
  ids?: Record<string, string | number | null | undefined>;
};

export function sanitizarErro(erro: unknown): string {
  const bruto =
    erro instanceof Error ? erro.message : typeof erro === "string" ? erro : "erro";
  return bruto
    .replace(PROIBIDOS, "[redigido]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redigido]")
    .slice(0, 180);
}

export function logSeguro(nivel: "info" | "error", entrada: LogSeguro): void {
  const payload = {
    evento: entrada.evento,
    correlationId: entrada.correlationId,
    status: entrada.status,
    ids: entrada.ids,
  };
  if (nivel === "error") {
    console.error("[app]", payload);
    return;
  }
  console.info("[app]", payload);
}
