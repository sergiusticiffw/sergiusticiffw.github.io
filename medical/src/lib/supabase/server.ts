import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

import { getSupabaseEnv } from "@/lib/env";

export const createClient = cache(async function createClient() {
  const env = getSupabaseEnv();
  if (!env) {
    throw new Error("Conexiunea cu Supabase nu este configurată.");
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. The proxy refreshes the session.
        }
      },
    },
  });
});
