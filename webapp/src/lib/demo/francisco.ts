/**
 * Constantes da obra demo "Residência de Francisco" (S5.6 / planilha §7).
 * Valores em centavos. Usados pelo seed e por testes de expectativa financeira.
 */
import {
  calcularFinanceiro,
  calcularNovaDataTermino,
} from "@/lib/relatorios/calculos";
import { ETAPAS_PADRAO } from "@/lib/obras/etapas";

export const DEMO_FRANCISCO = {
  email: "demo.francisco@comoestaminhaobra.local",
  nomeEmpreiteiro: "Demo Empreiteiro",
  obraNome: "Residência de Francisco",
  clienteNome: "Francisco",
  endereco: "Rua das Palmeiras, 120 — Salvador, BA",
  inicioContratual: "2026-03-01",
  terminoContratual: "2026-12-31",
  valorContratadoCentavos: 100_000_000,
  sinalCentavos: 10_000_000,
  medicoesCentavos: [5_000_000, 6_000_000, 5_000_000] as const,
  materiais: [
    { rotulo: "Aço", valorCentavos: 2_300_000 },
    { rotulo: "Madeira", valorCentavos: 1_200_000 },
    { rotulo: "Pisos", valorCentavos: 2_000_000 },
    { rotulo: "Argamassas", valorCentavos: 800_000 },
  ] as const,
  aditivosCentavos: [3_000_000, 300_000] as const,
  diasAditivados: [
    { motivo: "chuvas" as const, dias: 18, descricao: "Paralisação por chuva" },
    {
      motivo: "aditivo_escopo" as const,
      dias: 12,
      descricao: "Ampliação de escopo",
    },
  ] as const,
  /** Índices 0–4 = 100%; Alvenarias 20; Cobertura 20; Elétricas 10 */
  pctEtapas: ETAPAS_PADRAO.map((_, i) => {
    if (i < 5) return 100;
    if (i === 5) return 20; // Alvenarias
    if (i === 6) return 20; // Cobertura
    if (i === 7) return 10; // Instalações elétricas e rede
    return 0;
  }),
} as const;

export function expectativasFinanceirasFrancisco() {
  const pagoCentavos = [
    DEMO_FRANCISCO.sinalCentavos,
    ...DEMO_FRANCISCO.medicoesCentavos,
    ...DEMO_FRANCISCO.materiais.map((m) => m.valorCentavos),
  ];
  const fin = calcularFinanceiro({
    valorContratadoCentavos: DEMO_FRANCISCO.valorContratadoCentavos,
    aditivosCentavos: [...DEMO_FRANCISCO.aditivosCentavos],
    pagoCentavos,
  });
  const terminoPrevisto = calcularNovaDataTermino(
    DEMO_FRANCISCO.terminoContratual,
    DEMO_FRANCISCO.diasAditivados.map((d) => d.dias),
  );
  return { ...fin, terminoPrevisto };
}
