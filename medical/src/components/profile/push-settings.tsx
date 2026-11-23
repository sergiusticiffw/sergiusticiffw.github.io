"use client";

import { useEffect, useState } from "react";

import {
  removePushSubscription,
  savePushSubscription,
} from "@/app/(app)/profile/push-actions";
import { Button } from "@/components/ui/button";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function currentSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return null;
  }
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function PushSettings({
  vapidPublicKey,
  initiallyEnabled,
}: {
  vapidPublicKey: string | null;
  initiallyEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
  }, []);

  async function enable() {
    if (!vapidPublicKey) {
      setError("Cheile VAPID lipsesc pe server.");
      return;
    }
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Permisiunea pentru notificări a fost refuzată.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const json = subscription.toJSON();
      const endpoint = json.endpoint ?? "";
      const p256dh = json.keys?.p256dh ?? "";
      const auth = json.keys?.auth ?? "";
      const formData = new FormData();
      formData.set("endpoint", endpoint);
      formData.set("p256dh", p256dh);
      formData.set("auth", auth);
      formData.set("userAgent", navigator.userAgent);

      const result = await savePushSubscription({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEnabled(true);
      setMessage(
        "Notificările sunt active. Dimineața la ~07:00 primești reminder pentru programările de azi și de mâine.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Notificările nu au putut fi activate pe acest dispozitiv.",
      );
    } finally {
      setPending(false);
    }
  }

  async function disable() {
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const subscription = await currentSubscription();
      const formData = new FormData();
      if (subscription?.endpoint) {
        formData.set("endpoint", subscription.endpoint);
        await subscription.unsubscribe().catch(() => undefined);
      }
      const result = await removePushSubscription({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEnabled(false);
      setMessage("Notificările au fost dezactivate pe acest dispozitiv.");
    } catch {
      setError("Notificările nu au putut fi dezactivate.");
    } finally {
      setPending(false);
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-muted-foreground">
        Browserul sau dispozitivul nu suportă Web Push. Pe iPhone: iOS 16.4+,
        app adăugată pe ecranul Home, apoi activează din Cont.
      </p>
    );
  }

  if (!vapidPublicKey) {
    return (
      <p className="text-sm text-muted-foreground">
        Notificările nu sunt configurate pe server (lipsesc cheile VAPID).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="text-muted-foreground">
        Reminder zilnic ~07:00 (Chișinău) pentru programările de azi și de
        mâine. Pe iPhone trebuie instalată aplicația pe ecranul Home.
      </p>
      <p>
        <span className="text-muted-foreground">Stare: </span>
        {enabled ? "activate pe acest cont" : "dezactivate"}
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        {enabled ? (
          <Button
            type="button"
            variant="outline"
            loading={pending}
            onClick={() => {
              void disable();
            }}
          >
            {pending ? "Se dezactivează…" : "Dezactivează notificările"}
          </Button>
        ) : (
          <Button
            type="button"
            loading={pending}
            onClick={() => {
              void enable();
            }}
          >
            {pending ? "Se activează…" : "Activează notificările"}
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      {message ? <p className="text-muted-foreground">{message}</p> : null}
    </div>
  );
}
