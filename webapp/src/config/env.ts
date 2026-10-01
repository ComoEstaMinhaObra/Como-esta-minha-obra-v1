import { z } from "zod";

const centavos = z.coerce.number().int().nonnegative();

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS: centavos,
  NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS: centavos,
  NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS: centavos,
  // Preço da obra ativa (cobrança por obra). Enquanto ausente, vale o preço de 1 obra.
  NEXT_PUBLIC_PRECO_OBRA_CENTAVOS: centavos.optional(),
  NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS: centavos,
  NEXT_PUBLIC_TRIAL_DIAS: z.coerce.number().int().positive(),
  NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS: z.coerce.number().int().nonnegative(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional().default(""),
});

const adminSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

const cronSchema = z.object({
  CRON_SECRET: z.string().min(1),
});

const emailSchema = z.object({
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
});

const cobrancaSchema = z.object({
  ABACATEPAY_API_KEY: z.string().min(1),
  ABACATEPAY_WEBHOOK_SECRET: z.string().min(1),
  ABACATEPAY_PROD_OBRA_1: z.string().min(1),
  ABACATEPAY_PROD_OBRA_3: z.string().min(1),
  ABACATEPAY_PROD_OBRA_5: z.string().min(1),
  // Produto único da cobrança por obra; passa a ser obrigatório quando o checkout novo entrar (E4).
  ABACATEPAY_PROD_OBRA_ATIVA: z.string().min(1).optional(),
  ABACATEPAY_PROD_EMAIL_EXTRA: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type AdminEnv = z.infer<typeof adminSchema>;
export type CronEnv = z.infer<typeof cronSchema>;
export type EmailEnv = z.infer<typeof emailSchema>;
export type CobrancaEnv = z.infer<typeof cobrancaSchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
}

/**
 * Valida só o recorte de variáveis de um domínio. Cada domínio falha sozinho:
 * cobrança ausente não derruba relatório, e-mail ausente não derruba cobrança.
 */
function lerEnv<S extends z.ZodTypeAny>(
  schema: S,
  valores: Record<string, string | undefined>,
  rotulo: string,
): z.infer<S> {
  const parsed = schema.safeParse(valores);
  if (!parsed.success) {
    throw new Error(
      `Variáveis de ambiente (${rotulo}) inválidas ou ausentes:\n${formatZodError(parsed.error)}`,
    );
  }
  return parsed.data;
}

function readPublicEnv(): PublicEnv {
  return lerEnv(
    publicSchema,
    {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS:
        process.env.NEXT_PUBLIC_PRECO_1_OBRA_CENTAVOS,
      NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS:
        process.env.NEXT_PUBLIC_PRECO_3_OBRAS_CENTAVOS,
      NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS:
        process.env.NEXT_PUBLIC_PRECO_5_OBRAS_CENTAVOS,
      NEXT_PUBLIC_PRECO_OBRA_CENTAVOS:
        process.env.NEXT_PUBLIC_PRECO_OBRA_CENTAVOS,
      NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS:
        process.env.NEXT_PUBLIC_PRECO_EMAIL_EXTRA_CENTAVOS,
      NEXT_PUBLIC_TRIAL_DIAS: process.env.NEXT_PUBLIC_TRIAL_DIAS,
      NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS:
        process.env.NEXT_PUBLIC_TRIAL_LIMITE_RELATORIOS,
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    },
    "públicas",
  );
}

/** Variáveis públicas (ok no client). Validação eager — falha no import se ausentes. */
export const publicEnv: PublicEnv = readPublicEnv();

/**
 * Os getters abaixo são só para servidor (Server Components, Route Handlers,
 * Server Actions e scripts). Nunca importar em Client Components.
 */

/** Client admin do Supabase. */
export function getAdminEnv(): AdminEnv {
  return lerEnv(
    adminSchema,
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    },
    "Supabase admin",
  );
}

/** Rotas de cron. */
export function getCronEnv(): CronEnv {
  return lerEnv(
    cronSchema,
    { CRON_SECRET: process.env.CRON_SECRET },
    "cron",
  );
}

/** Envio de e-mail (Resend). */
export function getEmailEnv(): EmailEnv {
  return lerEnv(
    emailSchema,
    {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
    },
    "e-mail",
  );
}

/** Cobrança (AbacatePay): API, webhook e produtos. */
export function getCobrancaEnv(): CobrancaEnv {
  return lerEnv(
    cobrancaSchema,
    {
      ABACATEPAY_API_KEY: process.env.ABACATEPAY_API_KEY,
      ABACATEPAY_WEBHOOK_SECRET: process.env.ABACATEPAY_WEBHOOK_SECRET,
      ABACATEPAY_PROD_OBRA_1: process.env.ABACATEPAY_PROD_OBRA_1,
      ABACATEPAY_PROD_OBRA_3: process.env.ABACATEPAY_PROD_OBRA_3,
      ABACATEPAY_PROD_OBRA_5: process.env.ABACATEPAY_PROD_OBRA_5,
      ABACATEPAY_PROD_OBRA_ATIVA: process.env.ABACATEPAY_PROD_OBRA_ATIVA,
      ABACATEPAY_PROD_EMAIL_EXTRA: process.env.ABACATEPAY_PROD_EMAIL_EXTRA,
    },
    "cobrança",
  );
}
