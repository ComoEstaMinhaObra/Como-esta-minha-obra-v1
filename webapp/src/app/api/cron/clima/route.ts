import { NextResponse } from "next/server";
import { getServerEnv } from "@/config/env";
import { sincronizarClimaObra } from "@/lib/clima/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const env = getServerEnv();
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: obras, error } = await admin
    .from("obras")
    .select("id, lat, lng")
    .is("arquivada_em", null)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (error) {
    return NextResponse.json({ erro: error.message }, { status: 500 });
  }

  let ok = 0;
  let falhas = 0;
  const detalhes: { obraId: string; upserted?: number; erro?: string }[] = [];

  for (const obra of obras ?? []) {
    if (obra.lat == null || obra.lng == null) continue;
    try {
      const result = await sincronizarClimaObra(obra.id, obra.lat, obra.lng);
      ok += 1;
      detalhes.push({ obraId: obra.id, upserted: result.upserted });
    } catch (e) {
      falhas += 1;
      detalhes.push({
        obraId: obra.id,
        erro: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    processadas: ok + falhas,
    ok,
    falhas,
    detalhes,
  });
}
