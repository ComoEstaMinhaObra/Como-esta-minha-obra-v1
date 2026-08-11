import type { CondicaoClima, DiaClima, WeatherProvider } from "./tipos";

/** Mapeia código WMO Open-Meteo → condição do produto. */
export function mapearCodigoWmo(codigo: number): CondicaoClima {
  if (codigo <= 1) return "aberto";
  if (codigo === 2 || codigo === 3 || codigo === 45 || codigo === 48) {
    return "nublado";
  }
  if (codigo >= 51) return "chuvoso";
  return "nublado";
}

/**
 * Probabilidade de chuva: usa precipitation_probability_max quando disponível;
 * em dias passados sem probabilidade, deriva de precipitation_sum.
 */
export function calcularProbChuva(
  probMax: number | null | undefined,
  precipSum: number | null | undefined,
): number {
  if (probMax != null && !Number.isNaN(probMax)) {
    return Math.round(probMax);
  }
  const soma = precipSum ?? 0;
  return soma > 1.0 ? 80 : 10;
}

type OpenMeteoDaily = {
  time: string[];
  weather_code: number[];
  precipitation_probability_max: (number | null)[];
  precipitation_sum: (number | null)[];
};

type OpenMeteoResponse = {
  daily?: OpenMeteoDaily;
};

export async function buscarDiasOpenMeteo(
  lat: number,
  lng: number,
  fetchFn: typeof fetch = fetch,
): Promise<DiaClima[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&daily=weather_code,precipitation_probability_max,precipitation_sum` +
    `&past_days=7&forecast_days=1&timezone=America%2FBahia`;

  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Open-Meteo HTTP ${res.status}`);
  }

  const json = (await res.json()) as OpenMeteoResponse;
  const daily = json.daily;
  if (!daily?.time?.length) return [];

  return daily.time.map((data, i) => {
    const codigo = daily.weather_code[i] ?? 0;
    const condicao = mapearCodigoWmo(codigo);
    const probChuva = calcularProbChuva(
      daily.precipitation_probability_max[i],
      daily.precipitation_sum[i],
    );
    return { data, condicao, probChuva };
  });
}

export const openMeteoProvider: WeatherProvider = {
  buscarDias: (lat, lng) => buscarDiasOpenMeteo(lat, lng),
};
