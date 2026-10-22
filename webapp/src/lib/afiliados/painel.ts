import "server-only";

import { z } from "zod";
import { logSeguro } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const duracaoSchema = z.enum(["primeira_fatura", "permanente"]);
const inteiro = z.number().int();

const linkSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  rotulo: z.string(),
  ativo: z.boolean(),
  comissaoBps: inteiro,
  vitalicia: z.boolean(),
  descontoBps: inteiro,
  descontoDuracao: duracaoSchema.nullable(),
  cadastros: inteiro,
  assinantes: inteiro,
  ativos: inteiro,
  ganhosCentavos: inteiro,
});

const comissaoSchema = z.object({
  id: z.string(),
  em: z.string(),
  linkCodigo: z.string(),
  valorCentavos: inteiro,
  disponivelEm: z.string(),
  status: z.enum(["pendente", "disponivel", "estornada"]),
});

const saqueSchema = z.object({
  id: z.string(),
  valorCentavos: inteiro,
  status: z.enum(["solicitado", "pago", "recusado"]),
  tipoChave: z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]),
  chaveMascarada: z.string(),
  solicitadoEm: z.string(),
  resolvidoEm: z.string().nullable(),
  observacao: z.string().nullable(),
});

const painelSchema = z.object({
  afiliado: z.literal(true),
  config: z.object({ carenciaDias: inteiro, saqueMinimoCentavos: inteiro }),
  saldo: z.object({
    disponivelCentavos: inteiro,
    pendenteCentavos: inteiro,
    recebidoCentavos: inteiro,
    totalGanhoCentavos: inteiro,
  }),
  saqueAberto: z.boolean(),
  links: z.array(linkSchema),
  comissoes: z.array(comissaoSchema),
  saques: z.array(saqueSchema),
});

export type PainelAfiliado = z.infer<typeof painelSchema>;
export type LinkAfiliado = PainelAfiliado["links"][number];

/** Valida o jsonb de fn_afiliado_painel; `null` se não for afiliado ou se vier fora do contrato. */
export function parsearPainel(valor: unknown): PainelAfiliado | null {
  const r = painelSchema.safeParse(valor);
  return r.success ? r.data : null;
}

export type CarregarPainelResult =
  | { ok: true; painel: PainelAfiliado }
  | { ok: false; motivo: "NAO_AFILIADO" | "ERRO" };

export async function carregarPainelAfiliado(): Promise<CarregarPainelResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_afiliado_painel");
  if (error) {
    logSeguro("error", { evento: "afiliado_painel", status: error.code });
    return { ok: false, motivo: "ERRO" };
  }
  if ((data as { afiliado?: boolean } | null)?.afiliado !== true) {
    return { ok: false, motivo: "NAO_AFILIADO" };
  }
  const painel = parsearPainel(data);
  if (!painel) {
    logSeguro("error", { evento: "afiliado_painel_resposta_invalida" });
    return { ok: false, motivo: "ERRO" };
  }
  return { ok: true, painel };
}
