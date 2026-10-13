import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Conexiunea cu Supabase nu este configurată.");
  }

  return createBrowserClient(env.url, env.anonKey);
}
