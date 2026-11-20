"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // Only the digest is logged: the message may contain record details.
    const digest =
      error instanceof Error && "digest" in error
        ? String((error as { digest?: unknown }).digest ?? "")
        : "";
    console.error("appError", digest || "no-digest");
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-1 flex-col items-start justify-center gap-4 py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight">
        Ceva nu a funcționat
      </h1>
      <p className="text-base text-muted-foreground">
        Pagina nu a putut fi încărcată. Datele tale nu au fost modificate.
        Verifică conexiunea la internet și încearcă din nou.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={() => retry()}>
          Încearcă din nou
        </Button>
        <a
          href="/profiles"
          className="inline-flex h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Înapoi la persoane
        </a>
      </div>
    </div>
  );
}
