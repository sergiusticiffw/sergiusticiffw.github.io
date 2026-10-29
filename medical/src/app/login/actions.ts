"use server";

import { redirect } from "next/navigation";

import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  newPasswordSchema,
  recoverySchema,
  type LoginInput,
  type NewPasswordInput,
  type RecoveryInput,
} from "@/lib/validation/auth";

export type ActionResult = {
  error?: string;
  message?: string;
};

export async function login(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Verifică emailul și parola." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return { error: "Emailul sau parola nu sunt corecte." };
    }
  } catch (error) {
    console.error("login", error instanceof Error ? error.name : "unknown");
    return { error: "Conexiunea cu Supabase nu este configurată." };
  }

  redirect("/profiles");
}

/** Verifies password without redirect — used by biometric lock fallback. */
export async function verifyPassword(
  input: LoginInput,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Verifică emailul și parola." };
  }

  try {
    const supabase = await createClient();
    const { data: current } = await supabase.auth.getUser();
    if (current.user?.email && current.user.email !== parsed.data.email) {
      return { error: "Emailul nu corespunde contului curent." };
    }
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return { error: "Emailul sau parola nu sunt corecte." };
    }
  } catch (error) {
    console.error(
      "verifyPassword",
      error instanceof Error ? error.name : "unknown",
    );
    return { error: "Conexiunea cu Supabase nu este configurată." };
  }

  return {};
}

export async function requestPasswordReset(
  input: RecoveryInput,
): Promise<ActionResult> {
  const parsed = recoverySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Introdu un email valid." };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/login/parola-noua")}`,
      },
    );

    if (error) {
      console.error("requestPasswordReset", error.code);
      return { error: "Emailul nu a putut fi trimis. Încearcă din nou." };
    }
  } catch (error) {
    console.error(
      "requestPasswordReset",
      error instanceof Error ? error.name : "unknown",
    );
    return { error: "Conexiunea cu Supabase nu este configurată." };
  }

  return {
    message:
      "Dacă există un cont pentru acest email, vei primi un link de recuperare.",
  };
}

export async function updatePassword(
  input: NewPasswordInput,
): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Verifică parola nouă." };
  }

  try {
    const supabase = await createClient();
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) {
      return {
        error: "Linkul de recuperare a expirat. Cere un link nou.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      console.error("updatePassword", error.code);
      return { error: "Parola nu a putut fi schimbată." };
    }
  } catch (error) {
    console.error(
      "updatePassword",
      error instanceof Error ? error.name : "unknown",
    );
    return { error: "Conexiunea cu Supabase nu este configurată." };
  }

  redirect("/profiles");
}

export async function logout() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("logout", error instanceof Error ? error.name : "unknown");
  }

  redirect("/login");
}
