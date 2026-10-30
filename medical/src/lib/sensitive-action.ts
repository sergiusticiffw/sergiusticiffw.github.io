"use client";

import { confirmSensitiveUnlock } from "@/lib/biometric-lock";
import { createClient } from "@/lib/supabase/client";

/** Re-prompts biometrics when device lock is enabled, before a destructive action. */
export async function requireSensitiveUnlock(): Promise<{ error?: string }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return { error: "Sesiunea a expirat. Autentifică-te din nou." };
    }
    return confirmSensitiveUnlock(data.user.id);
  } catch (error) {
    console.error(
      "requireSensitiveUnlock",
      error instanceof Error ? error.name : "unknown",
    );
    return { error: "Verificarea biometrică a eșuat." };
  }
}
