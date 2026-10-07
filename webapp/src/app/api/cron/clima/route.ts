import { NextResponse } from "next/server";
import { getCronEnv } from "@/config/env";
import { geocodificarEndereco } from "@/lib/clima/geocode";
import { sincronizarClimaObra } from "@/lib/clima/sincronizar";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const env = getCronEnv();
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "nao autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  // Obras que ficaram sem coordenadas (endereço que o geocoder não entendeu na criação) ganham
  // outra tentativa por dia, poucas por execução para respeitar o limite do Nominatim.
  const { data: semCoordenadas } = await admin
    .from("obras")
    .select("id, endereco")
    .is("arquivada_em", null)
    .is("lat", null)
    .order("criado_em", { ascending: false })
    .limit(3);
  let geocodificadas = 0;
  for (const obra of semCoordenadas ?? []) {
    const geo = await geocodificarEndereco(obra.endereco);
    if (!geo) continue;
    const { error: upErr } = await admin
      .from("obras")
      .update({ lat: geo.lat, lng: geo.lng })
      .eq("id", obra.id);
    if (!upErr) geocodificadas += 1;
  }

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
    geocodificadas,
    processadas: ok + falhas,
    ok,
    falhas,
    detalhes,
  });
}
