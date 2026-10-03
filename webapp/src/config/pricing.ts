import { publicEnv } from "@/config/env";

export const TRIAL = {
  dias: publicEnv.NEXT_PUBLIC_TRIAL_DIAS,
  limiteRelatorios: publicEnv.NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS,
  limiteObras: 1,
} as const;

/** Cobrança por obra (decisões de 28/09 e 01/10/2026): uma assinatura mensal por obra ativa. */
export const OBRA_ATIVA = {
  nome: "Obra ativa",
  precoCentavos: publicEnv.NEXT_PUBLIC_PRECO_OBRA_CENTAVOS,
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
