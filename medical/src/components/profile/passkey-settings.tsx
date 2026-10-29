"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type PasskeyRow = {
  id: string;
  friendly_name?: string | null;
  created_at: string;
  last_used_at?: string | null;
};

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

export function PasskeySettings() {
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function onRegister() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error: registerError } = await supabase.auth.registerPasskey();
      if (registerError) {
        setError(formatPasskeyError(registerError));
        return;
      }
      setMessage(
        "Passkey adăugat. Poți intra în cont cu amprenta / Face ID de pe login.",
      );
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Înregistrarea passkey a eșuat.",
      );
    } finally {
      setPending(false);
    }
  }

  async function onDelete(passkeyId: string, label: string) {
    if (!window.confirm(`Ștergi passkey-ul „${label}”?`)) {
      return;
    }
    setPending(true);
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
      setMessage("Passkey șters.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Passkey-ul nu a putut fi șters.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Passkey-ul îți permite să te autentifici pe pagina de login cu amprenta,
        Face ID sau Windows Hello — fără a tasta parola. Diferit de deblocarea
        locală a ecranului.
      </p>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-muted-foreground">{message}</p> : null}
      {loading ? (
        <p className="text-muted-foreground">Se încarcă passkeys…</p>
      ) : passkeys.length === 0 ? (
        <p className="text-muted-foreground">Niciun passkey înregistrat încă.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((item) => {
            const label = item.friendly_name?.trim() || "Passkey";
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    Adăugat {new Date(item.created_at).toLocaleString("ro-RO")}
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
                    void onDelete(item.id, label);
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
        className="h-11 sm:w-fit"
        disabled={pending || loading}
        onClick={() => {
          void onRegister();
        }}
      >
        {pending ? "Se înregistrează…" : "Adaugă passkey de login"}
      </Button>
    </div>
  );
}
