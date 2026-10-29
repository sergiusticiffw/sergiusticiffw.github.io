"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { login } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

function formatPasskeyLoginError(error: {
  message?: string;
  code?: string;
} | null) {
  const code = error?.code ?? "";
  if (code === "passkey_disabled") {
    return "Passkeys nu sunt activate în proiectul Supabase.";
  }
  if (code === "webauthn_credential_not_found") {
    return "Nu există un passkey pentru acest dispozitiv. Intră cu parola și adaugă unul din Profil.";
  }
  if (
    code === "email_not_confirmed" ||
    code === "phone_not_confirmed" ||
    code === "user_banned"
  ) {
    return "Contul nu poate fi autentificat cu passkey acum.";
  }
  if (error?.message?.toLowerCase().includes("not allowed")) {
    return "Autentificarea cu passkey a fost anulată.";
  }
  return error?.message || "Autentificarea cu passkey a eșuat.";
}

export function LoginForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [passkeyPending, setPasskeyPending] = useState(false);
  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await login(values);
    if (result?.error) {
      setFormError(result.error);
    }
  });

  async function onPasskeyLogin() {
    setFormError(null);
    setPasskeyPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPasskey();
      if (error) {
        setFormError(formatPasskeyLoginError(error));
        return;
      }
      router.replace("/profiles");
      router.refresh();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Autentificarea cu passkey a eșuat.",
      );
    } finally {
      setPasskeyPending(false);
    }
  }

  const busy = form.formState.isSubmitting || passkeyPending;

  return (
    <div className="flex flex-col gap-4">
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full"
        disabled={busy}
        onClick={() => {
          void onPasskeyLogin();
        }}
      >
        {passkeyPending ? "Se verifică…" : "Intră cu passkey / amprentă"}
      </Button>
      <div className="relative flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">sau cu parola</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <form
        method="post"
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username webauthn"
            className="h-11"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          {form.formState.errors.email ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.email.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Parolă</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            className="h-11"
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password")}
          />
          {form.formState.errors.password ? (
            <p className="text-sm text-destructive">
              {form.formState.errors.password.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="h-11 w-full" disabled={busy}>
          {form.formState.isSubmitting ? "Se verifică…" : "Intră în cont"}
        </Button>
        <Link
          href="/login/recuperare"
          className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Ai uitat parola?
        </Link>
      </form>
    </div>
  );
}
