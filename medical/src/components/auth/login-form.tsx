"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { login } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";

export function LoginForm() {
  const [formError, setFormError] = useState<string | null>(null);
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

  return (
    <form method="post" onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {formError ? (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
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
      <Button
        type="submit"
        className="h-11 w-full"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Se verifică…" : "Intră în cont"}
      </Button>
      <Link
        href="/login/recuperare"
        className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Ai uitat parola?
      </Link>
    </form>
  );
}
