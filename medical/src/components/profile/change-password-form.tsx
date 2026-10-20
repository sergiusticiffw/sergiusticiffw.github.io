"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { changeAccountPassword } from "@/app/(app)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  newPasswordSchema,
  type NewPasswordInput,
} from "@/lib/validation/auth";

export function ChangePasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setMessage(null);
    const result = await changeAccountPassword(values);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    setMessage(result.message ?? "Parola a fost actualizată.");
    form.reset();
  });

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="profile-password">Parolă nouă</Label>
        <Input
          id="profile-password"
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
        <Label htmlFor="profile-password-confirm">Confirmă parola</Label>
        <Input
          id="profile-password-confirm"
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
        variant="outline"
        className="h-11 w-fit"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Se salvează…" : "Schimbă parola"}
      </Button>
    </form>
  );
}
