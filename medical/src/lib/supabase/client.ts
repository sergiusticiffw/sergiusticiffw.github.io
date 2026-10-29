import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Conexiunea cu Supabase nu este configurată.");
  }

  // Passkeys (WebAuthn) require Dashboard: Authentication → Passkeys enabled,
  // with stable RP ID + HTTPS origins. API is experimental in supabase-js.
  return createBrowserClient(env.url, env.anonKey, {
    auth: {
      experimental: { passkey: true },
    },
  });
}
