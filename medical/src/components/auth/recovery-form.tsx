"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { requestPasswordReset } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recoverySchema, type RecoveryInput } from "@/lib/validation/auth";

export function RecoveryForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const form = useForm<RecoveryInput>({
    resolver: zodResolver(recoverySchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setMessage(null);
    const result = await requestPasswordReset(values);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setMessage(result.message ?? null);
  });

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-foreground">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="recovery-email">Email</Label>
        <Input
          id="recovery-email"
          type="email"
          autoComplete="email"
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
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Se trimite…" : "Trimite linkul"}
      </Button>
      <Link
        href="/login"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Înapoi la autentificare
      </Link>
    </form>
  );
}
