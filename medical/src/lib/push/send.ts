import "server-only";

import { sendNotification, setVapidDetails } from "web-push";

import { getVapidConfig } from "@/lib/push/vapid";

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
};

export async function sendWebPush(
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
): Promise<{ ok: true } | { ok: false; gone?: boolean; error: string }> {
  const vapid = getVapidConfig();
  if (!vapid) {
    return { ok: false, error: "VAPID lipsește." };
  }

  setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  try {
    await sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
      }),
      { TTL: 60 * 60 * 12 },
    );
    return { ok: true };
  } catch (error) {
    const status =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : undefined;
    if (status === 404 || status === 410) {
      return { ok: false, gone: true, error: "Abonament expirat." };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Trimiterea a eșuat.",
    };
  }
}
