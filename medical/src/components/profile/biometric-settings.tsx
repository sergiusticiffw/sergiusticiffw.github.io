"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  disableBiometric,
  enrollBiometric,
  isBiometricEnabled,
  isPlatformAuthenticatorAvailable,
  isBiometricSupported,
} from "@/lib/biometric-lock";

export function BiometricSettings({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [supported, setSupported] = useState(false);
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const hasApi = isBiometricSupported();
      const platform = hasApi ? await isPlatformAuthenticatorAvailable() : false;
      if (cancelled) return;
      setSupported(hasApi);
      setAvailable(platform);
      setEnabled(isBiometricEnabled(userId));
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onEnable() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await enrollBiometric({ userId, email });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEnabled(true);
    setMessage("Deblocarea biometrică este activă pe acest dispozitiv.");
  }

  function onDisable() {
    if (
      !window.confirm(
        "Dezactivezi deblocarea biometrică pe acest dispozitiv?",
      )
    ) {
      return;
    }
    disableBiometric(userId);
    setEnabled(false);
    setError(null);
    setMessage("Deblocarea biometrică a fost dezactivată.");
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p>
        <span className="text-muted-foreground">Stare: </span>
        {!supported
          ? "indisponibil în acest browser"
          : !available
            ? "fără Face ID / amprentă / Windows Hello pe dispozitiv"
            : enabled
              ? "activ pe acest dispozitiv"
              : "inactiv"}
      </p>
      <p className="text-muted-foreground">
        După autentificare, dosarul se poate bloca pe dispozitiv și se
        deblochează cu biometrie. Sesiunea rămâne; doar ecranul este protejat.
      </p>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-muted-foreground">{message}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {enabled ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:w-fit"
            disabled={pending}
            onClick={onDisable}
          >
            Dezactivează
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 sm:w-fit"
            disabled={pending || !supported || !available}
            onClick={() => {
              void onEnable();
            }}
          >
            {pending ? "Se activează…" : "Activează biometria"}
          </Button>
        )}
      </div>
    </div>
  );
}
