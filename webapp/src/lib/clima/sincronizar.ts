import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { openMeteoProvider } from "./open-meteo";

/** Busca clima e faz upsert em clima_snapshots (service role). */
export async function sincronizarClimaObra(
  obraId: string,
  lat: number,
  lng: number,
): Promise<{ upserted: number }> {
  const dias = await openMeteoProvider.buscarDias(lat, lng);
  if (dias.length === 0) return { upserted: 0 };

  const admin = createAdminClient();
  const rows = dias.map((d) => ({
    obra_id: obraId,
    data: d.data,
    condicao: d.condicao,
    prob_chuva: d.probChuva,
    fonte: "open-meteo",
  }));

  const { error } = await admin.from("clima_snapshots").upsert(rows, {
    onConflict: "obra_id,data",
  });

  if (error) {
    throw new Error(`clima upsert falhou: ${error.message}`);
  }

  return { upserted: rows.length };
}
