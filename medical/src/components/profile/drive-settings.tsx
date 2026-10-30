"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { disconnectGoogleDrive } from "@/app/(app)/profile/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { requireSensitiveUnlock } from "@/lib/sensitive-action";
import { cn } from "@/lib/utils";

export function DriveSettings({
  status,
  configured,
  connected,
  expired = false,
  updatedAt,
  isAdmin,
}: {
  status?: string;
  configured: boolean;
  connected: boolean;
  expired?: boolean;
  updatedAt: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message =
    status === "connected"
      ? "Google Drive este conectat. Fișierele rămân private, fără link public."
      : status === "config"
        ? "Completează pe server clientul OAuth și cheia de criptare."
        : status === "error"
          ? "Conectarea cu Google Drive nu a reușit."
          : expired
            ? "Accesul Google Drive a expirat. Reconectează-te ca să încarci sau deschizi fișiere."
            : null;

  async function onDisconnect() {
    setPending(true);
    setError(null);
    const unlock = await requireSensitiveUnlock();
    if (unlock.error) {
      setError(unlock.error);
      setPending(false);
      return;
    }
    const result = await disconnectGoogleDrive();
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    setOpen(false);
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p
          role={status === "connected" ? "status" : "alert"}
          className={
            status === "connected" ? "text-sm" : "text-sm text-destructive"
          }
        >
          {message}
        </p>
      ) : null}
      <p className="text-sm">
        {expired ? "Expirat" : connected ? "Conectat" : "Neconectat"}
        {connected && updatedAt ? ` · actualizat ${updatedAt}` : null}
      </p>
      <p className="text-sm text-muted-foreground">
        PDF-urile și fotografiile stau într-un folder privat din My Drive.
        Poți alege alt cont Google prin reconectare.
      </p>
      {isAdmin ? (
        configured ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/api/google/connect"
              className={cn(
                buttonVariants({
                  variant: connected && !expired ? "outline" : "default",
                }),
                "h-11 w-fit",
              )}
            >
              {connected || expired
                ? "Reconectează Google Drive"
                : "Conectează Google Drive"}
            </Link>
            {connected ? (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setOpen(true);
                }}
              >
                Deconectează
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Configurarea Google lipsește pe server.
          </p>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Doar administratorul familiei poate conecta sau schimba contul Google.
        </p>
      )}
      <ConfirmDialog
        open={open}
        title="Deconectezi Google Drive?"
        description="Încărcările noi nu vor mai funcționa până reconectezi un cont. Fișierele rămân în Drive."
        confirmLabel="Deconectează"
        pendingLabel="Se deconectează…"
        pending={pending}
        error={error}
        onConfirm={() => {
          void onDisconnect();
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
