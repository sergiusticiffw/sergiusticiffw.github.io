"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  disableBiometric,
  enrollBiometric,
  isBiometricEnabled,
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
} from "@/lib/biometric-lock";
import { createClient } from "@/lib/supabase/client";

type PasskeyRow = {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  last_used_at?: string | null;
};

type ConfirmTarget =
  | { type: "passkey"; id: string; label: string }
  | { type: "lock" }
  | null;

function formatPasskeyError(error: { message?: string; code?: string } | null) {
  const code = error?.code ?? "";
  if (code === "passkey_disabled") {
    return "Passkeys nu sunt activate în proiectul Supabase (Authentication → Passkeys).";
  }
  if (code === "too_many_passkeys") {
    return "Ai atins numărul maxim de passkeys pe acest cont.";
  }
  if (code === "webauthn_credential_exists") {
    return "Această amprentă / acest dispozitiv e deja înregistrat.";
  }
  if (error?.message?.toLowerCase().includes("not allowed")) {
    return "Operațiunea a fost anulată.";
  }
  return error?.message || "Passkey-ul nu a putut fi procesat.";
}

export function SecuritySettings({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [passkeyLoading, setPasskeyLoading] = useState(true);
  const [passkeyPending, setPasskeyPending] = useState(false);

  const [lockSupported, setLockSupported] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);
  const [lockEnabled, setLockEnabled] = useState(false);
  const [lockPending, setLockPending] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmTarget>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshPasskeys = useCallback(async () => {
    setPasskeyLoading(true);
    try {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.passkey.list();
      if (listError) {
        setError(formatPasskeyError(listError));
        setPasskeys([]);
        return;
      }
      setPasskeys((data as PasskeyRow[] | null) ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Lista de passkeys nu a putut fi încărcată.",
      );
      setPasskeys([]);
    } finally {
      setPasskeyLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshPasskeys();
  }, [refreshPasskeys]);

  useEffect(() => {
    let cancelled = false;
    async function loadLock() {
      const hasApi = isBiometricSupported();
      const platform = hasApi ? await isPlatformAuthenticatorAvailable() : false;
      if (cancelled) return;
      setLockSupported(hasApi);
      setLockAvailable(platform);
      setLockEnabled(isBiometricEnabled(userId));
    }
    void loadLock();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function onRegisterPasskey() {
    setPasskeyPending(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: registerError } = await supabase.auth.registerPasskey();
      if (registerError) {
        setError(formatPasskeyError(registerError));
        return;
      }
      setMessage("Passkey adăugat. Poți intra pe login cu amprenta / Face ID.");
      await refreshPasskeys();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Înregistrarea passkey a eșuat.",
      );
    } finally {
      setPasskeyPending(false);
    }
  }

  async function onDeletePasskey(passkeyId: string) {
    setPasskeyPending(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.auth.passkey.delete({
        passkeyId,
      });
      if (deleteError) {
        setError(formatPasskeyError(deleteError));
        return;
      }
      setConfirm(null);
      setMessage("Passkey șters.");
      await refreshPasskeys();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Passkey-ul nu a putut fi șters.",
      );
    } finally {
      setPasskeyPending(false);
    }
  }

  async function onEnableLock() {
    setLockPending(true);
    setError(null);
    setMessage(null);
    const result = await enrollBiometric({ userId, email });
    setLockPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setLockEnabled(true);
    setMessage("Blocarea ecranului pe acest dispozitiv este activă.");
  }

  function onDisableLock() {
    disableBiometric(userId);
    setConfirm(null);
    setLockEnabled(false);
    setError(null);
    setMessage("Blocarea ecranului a fost dezactivată.");
  }

  const lockStatus = !lockSupported
    ? "indisponibil în acest browser"
    : !lockAvailable
      ? "fără Face ID / amprentă pe dispozitiv"
      : lockEnabled
        ? "activă"
        : "inactivă";

  const pending = passkeyPending || lockPending;

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-muted-foreground">
        Folosește amprenta sau Face ID ca să intri în cont și, opțional, ca să
        blochezi ecranul pe acest dispozitiv după ce ești autentificat.
        Blocarea ascunde interfața pe dispozitiv; nu înlocuiește parola și nu
        închide sesiunea.
      </p>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-muted-foreground">{message}</p> : null}

      <div className="flex flex-col gap-3 rounded-lg border px-3 py-3">
        <div>
          <p className="font-medium">Intrare în cont</p>
          <p className="text-xs text-muted-foreground">
            Passkey pe pagina de login — fără a tasta parola.
          </p>
        </div>
        {passkeyLoading ? (
          <p className="text-muted-foreground">Se încarcă…</p>
        ) : passkeys.length === 0 ? (
          <p className="text-muted-foreground">Niciun passkey încă.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {passkeys.map((item) => {
              const label = item.friendly_name?.trim() || "Passkey";
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed px-2 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      Adăugat{" "}
                      {new Date(item.created_at).toLocaleString("ro-RO")}
                      {item.last_used_at
                        ? ` · folosit ${new Date(item.last_used_at).toLocaleString("ro-RO")}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-8 px-2 text-xs text-destructive"
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      setConfirm({ type: "passkey", id: item.id, label });
                    }}
                  >
                    Șterge
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <Button
          type="button"
          className="h-11 w-full sm:w-fit"
          disabled={pending || passkeyLoading}
          onClick={() => {
            void onRegisterPasskey();
          }}
        >
          {passkeyPending ? "Se înregistrează…" : "Adaugă passkey"}
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border px-3 py-3">
        <div>
          <p className="font-medium">Blocare ecran pe dispozitiv</p>
          <p className="text-xs text-muted-foreground">
            După login, cere biometria la revenirea în app. Stare: {lockStatus}.
          </p>
        </div>
        {lockEnabled ? (
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full sm:w-fit"
            disabled={pending}
            onClick={() => {
              setError(null);
              setConfirm({ type: "lock" });
            }}
          >
            Dezactivează blocarea
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 w-full sm:w-fit"
            disabled={pending || !lockSupported || !lockAvailable}
            onClick={() => {
              void onEnableLock();
            }}
          >
            {lockPending ? "Se activează…" : "Activează blocarea ecranului"}
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirm?.type === "passkey"}
        title={
          confirm?.type === "passkey"
            ? `Ștergi passkey-ul „${confirm.label}”?`
            : "Ștergi passkey-ul?"
        }
        description="Nu vei mai putea intra cu acest dispozitiv prin amprentă / Face ID până îl adaugi din nou."
        confirmLabel="Șterge passkey"
        pendingLabel="Se șterge…"
        pending={passkeyPending}
        onConfirm={() => {
          if (confirm?.type === "passkey") {
            void onDeletePasskey(confirm.id);
          }
        }}
        onCancel={() => {
          if (!passkeyPending) {
            setConfirm(null);
          }
        }}
      />
      <ConfirmDialog
        open={confirm?.type === "lock"}
        title="Dezactivezi blocarea ecranului?"
        description="Dosarul rămâne deschis pe acest dispozitiv fără amprentă după ce ești autentificat."
        confirmLabel="Dezactivează"
        pendingLabel="Se dezactivează…"
        onConfirm={onDisableLock}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
