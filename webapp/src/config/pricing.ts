import { publicEnv } from "@/config/env";

export type PlanoId = "obra_1" | "obra_3" | "obra_5";

export interface Plano {
  id: PlanoId;
  nome: string;
  precoCentavos: number;
  limiteObras: number;
  externalId: string;
}

export const PLANOS: Plano[] = [
  {
    id: "obra_1",
    nome: "1 obra",
    precoCentavos: publicEnv.NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS,
    limiteObras: 1,
    externalId: "plano-1-obra-v1",
  },
  {
    id: "obra_3",
    nome: "3 obras",
    precoCentavos: publicEnv.NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS,
    limiteObras: 3,
    externalId: "plano-3-obras-v1",
  },
  {
    id: "obra_5",
    nome: "5 obras",
    precoCentavos: publicEnv.NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS,
    limiteObras: 5,
    externalId: "plano-5-obras-v1",
  },
];

export const EMAIL_EXTRA = {
  nome: "E-mail extra",
  precoCentavos: publicEnv.NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS,
  externalId: "email-extra-v1",
} as const;

export const TRIAL = {
  dias: publicEnv.NEXT_PUBLIC_TRIAL_DIAS,
  limiteRelatorios: publicEnv.NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS,
  limiteObras: 1,
} as const;

export function planoPorId(id: PlanoId): Plano {
  const plano = PLANOS.find((p) => p.id === id);
  if (!plano) {
    throw new Error(`Plano desconhecido: ${id}`);
  }
  return plano;
}

/** Cobrança por obra (decisões de 28/09 e 01/10/2026): uma assinatura mensal por obra ativa. */
export const OBRA_ATIVA = {
  nome: "Obra ativa",
  precoCentavos:
    publicEnv.NEXT_PUBLIC_PRECO_OBRA_CENTAVOS ??
    publicEnv.NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS,
  externalId: "obra-ativa-v2",
} as const;

export const EMAIL_ADICIONAL = {
  nome: "E-mail adicional",
  precoCentavos: publicEnv.NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS,
  externalId: "email-adicional-v2",
} as const;

/** Total mensal em centavos: soma das faturas das obras e dos e-mails adicionais. */
export function calcularTotalMensal(
  obrasAtivas: number,
  emailsAdicionais = 0,
): number {
  if (
    !Number.isInteger(obrasAtivas) ||
    !Number.isInteger(emailsAdicionais) ||
    obrasAtivas < 0 ||
    emailsAdicionais < 0
  ) {
    throw new Error("Quantidades devem ser inteiros não negativos");
  }
  return (
    obrasAtivas * OBRA_ATIVA.precoCentavos +
    emailsAdicionais * EMAIL_ADICIONAL.precoCentavos
  );
}
