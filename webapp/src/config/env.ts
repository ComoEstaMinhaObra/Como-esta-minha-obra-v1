import { z } from "zod";

const centavos = z.coerce.number().int().nonnegative();

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS: centavos,
  NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS: centavos,
  NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS: centavos,
  NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS: centavos,
  NEXT_PUBLIC_TRIAL_DIAS: z.coerce.number().int().positive(),
  NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS: z.coerce.number().int().nonnegative(),
});

const serverSchema = publicSchema.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  ABACATEPAY_API_KEY: z.string().min(1),
  ABACATEPAY_WEBHOOK_SECRET: z.string().min(1),
  ABACATEPAY_PROD_OBRA_1: z.string().min(1),
  ABACATEPAY_PROD_OBRA_3: z.string().min(1),
  ABACATEPAY_PROD_OBRA_5: z.string().min(1),
  ABACATEPAY_PROD_EMAIL_EXTRA: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

function readPublicEnv(): PublicEnv {
  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS:
      process.env.NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS,
    NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS:
      process.env.NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS,
    NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS:
      process.env.NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS,
    NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS:
      process.env.NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS,
    NEXT_PUBLIC_TRIAL_DIAS: process.env.NEXT_PUBLIC_TRIAL_DIAS,
    NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS:
      process.env.NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS,
  });

  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente públicas inválidas ou ausentes:\n${formatZodError(parsed.error)}`,
    );
  }

  return parsed.data;
}

function readServerEnv(): ServerEnv {
  const parsed = serverSchema.safeParse({
    ...readPublicEnv(),
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ABACATEPAY_API_KEY: process.env.ABACATEPAY_API_KEY,
    ABACATEPAY_WEBHOOK_SECRET: process.env.ABACATEPAY_WEBHOOK_SECRET,
    ABACATEPAY_PROD_OBRA_1: process.env.ABACATEPAY_PROD_OBRA_1,
    ABACATEPAY_PROD_OBRA_3: process.env.ABACATEPAY_PROD_OBRA_3,
    ABACATEPAY_PROD_OBRA_5: process.env.ABACATEPAY_PROD_OBRA_5,
    ABACATEPAY_PROD_EMAIL_EXTRA: process.env.ABACATEPAY_PROD_EMAIL_EXTRA,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    CRON_SECRET: process.env.CRON_SECRET,
  });

  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente do servidor inválidas ou ausentes:\n${formatZodError(parsed.error)}`,
    );
  }

  return parsed.data;
}

/** Variáveis públicas (ok no client). Validação eager — falha no import se ausentes. */
export const publicEnv: PublicEnv = readPublicEnv();

/**
 * Variáveis de servidor (secretas). Só chamar em Server Components, Route Handlers,
 * Server Actions ou scripts. Nunca importar em Client Components.
 */
export function getServerEnv(): ServerEnv {
  return readServerEnv();
}
