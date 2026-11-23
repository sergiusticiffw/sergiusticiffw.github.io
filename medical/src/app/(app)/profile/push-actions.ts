"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PushActionResult = {
  error?: string;
  saved?: boolean;
  enabled?: boolean;
};

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function savePushSubscription(
  _previous: PushActionResult,
  formData: FormData,
): Promise<PushActionResult> {
  const user = await getCurrentUser();
  const endpoint = field(formData, "endpoint");
  const p256dh = field(formData, "p256dh");
  const auth = field(formData, "auth");
  const userAgent = field(formData, "userAgent").slice(0, 400);

  if (!endpoint || !p256dh || !auth) {
    return { error: "Datele de abonament sunt incomplete." };
  }
  if (endpoint.length > 2048 || p256dh.length > 512 || auth.length > 512) {
    return { error: "Datele de abonament sunt invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    console.error("savePushSubscription", error.code, error.message);
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { error: "Aplică migrația pentru notificări în Supabase." };
    }
    if (error.code === "42501") {
      return { error: "Nu ai dreptul să salvezi abonamentul (RLS)." };
    }
    return { error: `Abonamentul nu a putut fi salvat (${error.code || "eroare"}).` };
  }

  return { saved: true, enabled: true };
}

export async function removePushSubscription(
  _previous: PushActionResult,
  formData: FormData,
): Promise<PushActionResult> {
  const user = await getCurrentUser();
  const endpoint = field(formData, "endpoint");
  const supabase = await createClient();

  let query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) {
    query = query.eq("endpoint", endpoint);
  }

  const { error } = await query;
  if (error) {
    console.error("removePushSubscription", error.code);
    return { error: "Abonamentul nu a putut fi dezactivat." };
  }

  return { saved: true, enabled: false };
}

export async function getPushSubscriptionStatus(): Promise<{
  enabled: boolean;
  error?: string;
}> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return { enabled: false, error: "Aplică migrația pentru notificări." };
    }
    console.error("getPushSubscriptionStatus", error.code);
    return { enabled: false, error: "Starea notificărilor nu a putut fi citită." };
  }

  return { enabled: (count ?? 0) > 0 };
}
