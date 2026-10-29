"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { verifyPassword } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  assertBiometric,
  clearUnlocked,
  isBiometricEnabled,
  isUnlocked,
  markHidden,
  markUnlocked,
  shouldRelockAfterIdle,
} from "@/lib/biometric-lock";

export function BiometricLockGate({
  userId,
  email,
  children,
}: {
  userId: string;
  email: string;
  children: ReactNode;
}) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");

  const syncLockState = useCallback(() => {
    if (!userId) {
      setLocked(false);
      setReady(true);
      return;
    }
    if (!isBiometricEnabled(userId)) {
      setLocked(false);
      setReady(true);
      return;
    }
    setLocked(!isUnlocked(userId));
    setReady(true);
  }, [userId]);

  useEffect(() => {
    syncLockState();
  }, [syncLockState]);

  useEffect(() => {
    if (!ready || !locked || usePassword) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setPending(true);
      setError(null);
      const result = await assertBiometric(userId);
      if (cancelled) {
        return;
      }
      setPending(false);
      if (result.error) {
        // Auto-prompt may fail silently on first paint; user can tap Deblochează.
        return;
      }
      setLocked(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, locked, usePassword, userId]);

  useEffect(() => {
    function onVisibility() {
      if (!userId || !isBiometricEnabled(userId)) {
        return;
      }
      if (document.visibilityState === "hidden") {
        markHidden(userId);
        return;
      }
      if (shouldRelockAfterIdle(userId)) {
        clearUnlocked(userId);
        setLocked(true);
        setUsePassword(false);
        setError(null);
        setPassword("");
      }
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [userId]);

  async function unlockWithBiometric() {
    setPending(true);
    setError(null);
    const result = await assertBiometric(userId);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLocked(false);
    setUsePassword(false);
    setPassword("");
  }

  async function unlockWithPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await verifyPassword({
      email,
      password,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    markUnlocked(userId);
    setLocked(false);
    setUsePassword(false);
    setPassword("");
  }

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center text-sm text-muted-foreground">
        Se încarcă…
      </div>
    );
  }

  return (
    <>
      <div
        className={locked ? "hidden" : "contents"}
        aria-hidden={locked || undefined}
      >
        {children}
      </div>
      {locked ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border bg-card p-5 text-card-foreground shadow-lg">
            <h2 className="text-lg font-semibold">Deblochează dosarul</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Folosește biometria acestui dispozitiv sau parola contului.
            </p>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {!usePassword ? (
              <div className="mt-4 flex flex-col gap-2">
                <Button
                  type="button"
                  className="h-11 w-full"
                  disabled={pending}
                  onClick={() => {
                    void unlockWithBiometric();
                  }}
                >
                  {pending ? "Se verifică…" : "Deblochează"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  disabled={pending}
                  onClick={() => {
                    setUsePassword(true);
                    setError(null);
                  }}
                >
                  Folosește parola
                </Button>
              </div>
            ) : (
              <form
                className="mt-4 flex flex-col gap-3"
                onSubmit={(event) => {
                  void unlockWithPassword(event);
                }}
              >
                <div className="flex flex-col gap-1">
                  <Label htmlFor="biometric-lock-email">Email</Label>
                  <Input
                    id="biometric-lock-email"
                    type="email"
                    className="h-11"
                    value={email}
                    readOnly
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="biometric-lock-password">Parolă</Label>
                  <Input
                    id="biometric-lock-password"
                    type="password"
                    autoComplete="current-password"
                    className="h-11"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={pending}>
                  {pending ? "Se verifică…" : "Deblochează cu parola"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full"
                  disabled={pending}
                  onClick={() => {
                    setUsePassword(false);
                    setError(null);
                    setPassword("");
                  }}
                >
                  Înapoi la biometrie
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
