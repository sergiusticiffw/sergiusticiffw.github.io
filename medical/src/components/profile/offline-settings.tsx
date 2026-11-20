"use client";

import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { refreshOfflineCopy } from "@/lib/offline/sync";
import {
  isOfflineEnabled,
  offlineSavedAt,
  offlineSupported,
  setOfflineFlag,
  wipeOfflineData,
} from "@/lib/offline/vault";

export function OfflineSettings({ userId }: { userId: string }) {
  const statusId = useId();
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const ok = offlineSupported();
      const on = ok && isOfflineEnabled(userId);
      const saved = on ? await offlineSavedAt(userId) : null;
      if (cancelled) {
        return;
      }
      setSupported(ok);
      setEnabled(on);
      setSavedAt(saved);
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function turnOn() {
    setPending(true);
    setError(null);
    setMessage(null);
    setOfflineFlag(userId, true);
    const result = await refreshOfflineCopy(userId);
    if ("error" in result) {
      setOfflineFlag(userId, false);
      await wipeOfflineData();
      setError(result.error);
    } else {
      setEnabled(true);
      setSavedAt(result.savedAt);
      setMessage("Fișa de urgență este salvată pe acest dispozitiv.");
    }
    setPending(false);
  }

  async function turnOff() {
    setPending(true);
    setError(null);
    setOfflineFlag(userId, false);
    await wipeOfflineData();
    setEnabled(false);
    setSavedAt(null);
    setMessage("Copia offline a fost ștearsă de pe acest dispozitiv.");
    setPending(false);
  }

  async function refresh() {
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await refreshOfflineCopy(userId);
    if ("error" in result) {
      setError(result.error);
    } else {
      setSavedAt(result.savedAt);
      setMessage("Copia offline a fost actualizată.");
    }
    setPending(false);
  }

  if (!ready) {
    return <p className="text-sm text-muted-foreground">Se verifică…</p>;
  }
  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Acest browser nu permite salvarea sigură pe dispozitiv.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Păstrează pe acest dispozitiv, criptat, fișa de urgență (grupă de sânge,
        alergii, afecțiuni, medicamente) și titlurile ultimelor înregistrări.
        Fără documente și fără IDNP. Se șterge la ieșirea din cont, la
        schimbarea contului sau după 30 de zile fără actualizare. Oricine are
        acces la dispozitivul deblocat poate vedea fișa offline.
      </p>
      {enabled ? (
        <p>
          <span className="text-muted-foreground">Ultima sincronizare: </span>
          {savedAt ? formatDateTime(new Date(savedAt).toISOString()) : "încă nu"}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        {enabled ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              aria-describedby={statusId}
              onClick={() => void refresh()}
            >
              Actualizează acum
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              aria-describedby={statusId}
              onClick={() => void turnOff()}
            >
              Oprește și șterge copia
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={pending}
            aria-describedby={statusId}
            onClick={() => void turnOn()}
          >
            {pending ? "Se salvează…" : "Activează fișa offline"}
          </Button>
        )}
      </div>
      <div id={statusId} aria-live="polite">
        {error ? <p className="text-destructive">{error}</p> : null}
        {message ? <p className="text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
