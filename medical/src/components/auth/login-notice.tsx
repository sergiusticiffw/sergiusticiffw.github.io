"use client";

import { useSearchParams } from "next/navigation";

export function LoginNotice() {
  const error = useSearchParams().get("error");
  const message =
    error === "config"
      ? "Conexiunea cu Supabase nu este configurată."
      : error === "auth"
        ? "Linkul de autentificare nu este valid sau a expirat."
        : null;

  if (!message) {
    return null;
  }

  return (
    <p role="alert" className="mb-4 text-sm text-destructive">
      {message}
    </p>
  );
}
