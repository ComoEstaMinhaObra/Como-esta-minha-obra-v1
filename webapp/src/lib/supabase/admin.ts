/**
 * Client com SUPABASE_SECRET_KEY (service role).
 * SOMENTE em Route Handlers, webhooks, crons e scripts server-side.
 * NUNCA importar em Client Components.
 */
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/config/env";
import type { Database } from "@/lib/database.types";

export function createAdminClient() {
  const env = getServerEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SECRET_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
