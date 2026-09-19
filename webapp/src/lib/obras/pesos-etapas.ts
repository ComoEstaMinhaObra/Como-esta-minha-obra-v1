export type EtapaComPeso = {
  nome: string;
  peso: number;
};

export const TOTAL_PESO_CENTESIMOS = 10_000;

export function sanitizarPesoDigitado(valor: string): string {
  const somenteNumeros = valor.replaceAll(".", ",").replace(/[^\d,]/g, "");
  const [parteInteira = "", ...partesDecimais] = somenteNumeros.split(",");
  const temSeparador = somenteNumeros.includes(",");
  const parteDecimal = partesDecimais.join("").slice(0, 2);
  const inteiro = parteInteira || (temSeparador ? "0" : "");

  return temSeparador ? `${inteiro},${parteDecimal}` : inteiro;
}

export function pesoDigitadoParaNumero(valor: string): number {
  const peso = Number(valor.replace(",", "."));
  return Number.isFinite(peso) ? peso : 0;
}

export function pesoParaCentesimos(peso: number): number {
  return Math.round(peso * 100);
}

export function pesoTemNoMaximoDuasCasas(peso: number): boolean {
  return Math.abs(peso * 100 - pesoParaCentesimos(peso)) < 1e-8;
}

export function validarEtapasSelecionadas(etapas: EtapaComPeso[]): boolean {
  if (etapas.length === 0 || etapas.length > 60) return false;

  let total = 0;
  for (const etapa of etapas) {
    if (
      !etapa.nome.trim() ||
      !Number.isFinite(etapa.peso) ||
      etapa.peso <= 0 ||
      !pesoTemNoMaximoDuasCasas(etapa.peso)
    ) {
      return false;
    }
    total += pesoParaCentesimos(etapa.peso);
  }

  return total === TOTAL_PESO_CENTESIMOS;
}
