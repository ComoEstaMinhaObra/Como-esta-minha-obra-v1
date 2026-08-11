export type CondicaoClima = "aberto" | "nublado" | "chuvoso";

export type DiaClima = {
  data: string; // YYYY-MM-DD
  condicao: CondicaoClima;
  probChuva: number | null;
};

export interface WeatherProvider {
  buscarDias(lat: number, lng: number): Promise<DiaClima[]>;
}
