export type GeoResultado = { lat: number; lng: number } | null;

const NOMINATIM_UA =
  "ComoEstaMinhaObra/1.0 (contato@comoestaminhaobra.com.br)";

/** A política de uso do Nominatim pede no máximo 1 requisição por segundo. */
const PAUSA_ENTRE_CONSULTAS_MS = 1100;

const ABREVIACOES: [RegExp, string][] = [
  [/\bav\.?(?=\s)/gi, "Avenida"],
  [/\br\.(?=\s)/gi, "Rua"],
  [/\btrav\.?(?=\s)/gi, "Travessa"],
  [/\bpç\.?(?=\s)/gi, "Praça"],
  [/\brod\.?(?=\s)/gi, "Rodovia"],
  [/\best\.(?=\s)/gi, "Estrada"],
  [/\bal\.(?=\s)/gi, "Alameda"],
];

function limpar(s: string): string {
  return s.replace(/\s+/g, " ").replace(/\s*,\s*/g, ", ").replace(/,\s*,/g, ",").trim();
}

/**
 * Consultas para tentar, da mais específica para a mais ampla. O Nominatim é sensível ao formato:
 * "Av. Brasil, 450, Curitiba - PR" não retorna nada, mas "Avenida Brasil, 450, Curitiba, PR, Brasil"
 * retorna. A última variante é só a cidade, suficiente para a previsão do tempo.
 */
export function variantesEndereco(endereco: string): string[] {
  const original = limpar(endereco);
  if (!original) return [];

  // "Cidade - UF" vira "Cidade, UF"; abreviações de logradouro são expandidas.
  let normal = original.replace(/\s+-\s+(?=[A-Za-z]{2}\b)/g, ", ");
  for (const [re, cheio] of ABREVIACOES) normal = normal.replace(re, cheio);
  normal = limpar(normal);

  const comPais = /,\s*brasil$/i.test(normal) ? normal : `${normal}, Brasil`;

  const partes = normal.split(",").map((p) => p.trim()).filter(Boolean);
  const cidade =
    partes.length >= 3 && /^[A-Za-z]{2}$/.test(partes[partes.length - 1])
      ? `${partes[partes.length - 2]}, ${partes[partes.length - 1]}, Brasil`
      : null;

  const todas = [comPais, original, cidade].filter((v): v is string => !!v);
  return [...new Set(todas)];
}

async function consultar(
  q: string,
  fetchFn: typeof fetch,
): Promise<GeoResultado> {
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=br`;
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

/**
 * Geocodifica o endereço via Nominatim (1× na criação da obra). Tenta o endereço normalizado, o
 * original e, por último, só a cidade.
 */
export async function geocodificarEndereco(
  endereco: string,
  fetchFn: typeof fetch = fetch,
  esperar: (ms: number) => Promise<void> = (ms) =>
    new Promise((r) => setTimeout(r, ms)),
): Promise<GeoResultado> {
  const consultas = variantesEndereco(endereco);
  for (let i = 0; i < consultas.length; i += 1) {
    if (i > 0) await esperar(PAUSA_ENTRE_CONSULTAS_MS);
    const geo = await consultar(consultas[i], fetchFn);
    if (geo) return geo;
  }
  return null;
}
