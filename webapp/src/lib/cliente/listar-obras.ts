import "server-only";

import { z } from "zod";
import { logSeguro } from "@/lib/log";
import { createClient } from "@/lib/supabase/server";

const obraResumoSchema = z.object({
  id: z.string().uuid(),
  nome: z.string().min(1),
  endereco: z.string().nullable(),
  avanco: z.number().finite().nullable(),
  inicioContratual: z.string().nullable(),
  entregaPrevista: z.string().nullable(),
  ultimoRelatorioNumero: z.number().int().positive().nullable(),
  ultimoRelatorioEm: z.string().nullable(),
  temRelatorioPublicado: z.boolean(),
});

const obrasResumoSchema = z.array(obraResumoSchema);

export type ObraResumoProprietario = z.infer<typeof obraResumoSchema>;

export function parsearObrasProprietario(
  valor: unknown,
): ObraResumoProprietario[] | null {
  const resultado = obrasResumoSchema.safeParse(valor);
  if (!resultado.success) return null;
  return resultado.data.map((obra) => ({
    ...obra,
    avanco:
      obra.avanco === null
        ? null
        : Math.min(100, Math.max(0, Math.round(obra.avanco))),
  }));
}

export type ListarObrasProprietarioResult =
  { ok: true; obras: ObraResumoProprietario[] } | { ok: false };

export async function listarObrasProprietario(): Promise<ListarObrasProprietarioResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fn_listar_obras_proprietario");

  if (error) {
    logSeguro("error", {
      evento: "listar_obras_proprietario",
      status: error.code,
    });
    return { ok: false };
  }

  const obras = parsearObrasProprietario(data);
  if (!obras) {
    logSeguro("error", {
      evento: "listar_obras_proprietario_resposta_invalida",
    });
    return { ok: false };
  }

  return { ok: true, obras };
}
