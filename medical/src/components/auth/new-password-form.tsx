"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { updatePassword } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  newPasswordSchema,
  type NewPasswordInput,
} from "@/lib/validation/auth";

export function NewPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const result = await updatePassword(values);
    if (result?.error) {
      setFormError(result.error);
    }
  });

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Parolă nouă</Label>
        <Input
          id="new-password"
          type="password"
          autoComplete="new-password"
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirmă parola</Label>
        <Input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          className="h-11"
          aria-invalid={Boolean(form.formState.errors.confirmPassword)}
          {...form.register("confirmPassword")}
        />
        {form.formState.errors.confirmPassword ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.confirmPassword.message}
          </p>
        ) : null}
      </div>
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Se salvează…" : "Salvează parola"}
      </Button>
      <Link
        href="/login/recuperare"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Cere un link nou
      </Link>
    </form>
  );
}
