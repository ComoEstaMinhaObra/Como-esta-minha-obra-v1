export type GeoResultado = { lat: number; lng: number } | null;

const NOMINATIM_UA =
  "ComoEstaMinhaObra/1.0 (contato@comoestaminhaobra.com.br)";

/** Geocodifica endereço via Nominatim (1× na criação da obra). */
export async function geocodificarEndereco(
  endereco: string,
  fetchFn: typeof fetch = fetch,
): Promise<GeoResultado> {
  const q = endereco.trim();
  if (!q) return null;

  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}&format=json&limit=1`;

  try {
    const res = await fetchFn(url, {
      headers: { "User-Agent": NOMINATIM_UA },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string }[];
    if (!json?.length) return null;
    const lat = Number(json[0].lat);
    const lng = Number(json[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
