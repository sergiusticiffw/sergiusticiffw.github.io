import "server-only";

import {
  formatReminderTime,
  reminderFor,
  type Reminder,
} from "@/lib/reminders";
import { sendWebPush } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileJoin = { family_id: string; display_name: string };

type AppointmentRow = {
  id: string;
  profile_id: string;
  title: string;
  starts_at: string;
  profiles: ProfileJoin | ProfileJoin[] | null;
};

function profileOf(row: AppointmentRow): ProfileJoin | null {
  if (!row.profiles) {
    return null;
  }
  return Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : row.profiles;
}

const WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Daily job (~07:00 Chișinău): notify subscribed family members about
 * appointments today or tomorrow. Dedupes via appointment_notification_deliveries.
 */
export async function sendDailyAppointmentReminders(now = new Date()) {
  const admin = createAdminClient();
  if (!admin) {
    return { ok: false as const, error: "Service role lipsește." };
  }

  const until = new Date(now.getTime() + WINDOW_MS).toISOString();
  const { data: appointments, error: appointmentsError } = await admin
    .from("appointments")
    .select(
      "id, profile_id, title, starts_at, profiles!inner(family_id, display_name)",
    )
    .is("done_at", null)
    .is("cancelled_at", null)
    .gte("starts_at", now.toISOString())
    .lt("starts_at", until)
    .order("starts_at", { ascending: true })
    .limit(200);

  if (appointmentsError) {
    console.error("sendDailyReminders appointments", appointmentsError.code);
    return { ok: false as const, error: "Programările nu au putut fi citite." };
  }

  const rows = (appointments ?? []) as AppointmentRow[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const appointment of rows) {
    const kind = reminderFor(appointment.starts_at, now);
    if (!kind) {
      skipped += 1;
      continue;
    }

    const profile = profileOf(appointment);
    const familyId = profile?.family_id;
    const personName = profile?.display_name ?? "persoană";
    if (!familyId) {
      skipped += 1;
      continue;
    }

    const { data: members, error: membersError } = await admin
      .from("family_members")
      .select("user_id")
      .eq("family_id", familyId);

    if (membersError) {
      console.error("sendDailyReminders members", membersError.code);
      failed += 1;
      continue;
    }

    const userIds = [
      ...new Set(
        ((members ?? []) as { user_id: string }[]).map((row) => row.user_id),
      ),
    ];
    if (userIds.length === 0) {
      skipped += 1;
      continue;
    }

    const { data: subscriptions, error: subsError } = await admin
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds);

    if (subsError) {
      console.error("sendDailyReminders subs", subsError.code);
      failed += 1;
      continue;
    }

    const payload = buildPayload(appointment, personName, kind);
    for (const sub of (subscriptions ?? []) as {
      id: string;
      user_id: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }[]) {
      const { data: existing } = await admin
        .from("appointment_notification_deliveries")
        .select("id")
        .eq("appointment_id", appointment.id)
        .eq("user_id", sub.user_id)
        .eq("reminder_kind", kind)
        .maybeSingle();

      if (existing) {
        skipped += 1;
        continue;
      }

      const result = await sendWebPush(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        payload,
      );

      if (!result.ok) {
        if (result.gone) {
          await admin.from("push_subscriptions").delete().eq("id", sub.id);
        }
        failed += 1;
        continue;
      }

      const { error: deliveryError } = await admin
        .from("appointment_notification_deliveries")
        .insert({
          appointment_id: appointment.id,
          user_id: sub.user_id,
          reminder_kind: kind,
        });

      if (deliveryError) {
        console.error("sendDailyReminders delivery", deliveryError.code);
        failed += 1;
        continue;
      }
      sent += 1;
    }
  }

  return { ok: true as const, sent, skipped, failed, checked: rows.length };
}

function buildPayload(
  appointment: AppointmentRow,
  personName: string,
  kind: Reminder,
) {
  const time = formatReminderTime(appointment.starts_at);
  const when = kind === "today" ? "astăzi" : "mâine";
  return {
    title: `Programare ${when}`,
    body: `${personName}: ${appointment.title} la ${time}`,
    url: `/profiles/${appointment.profile_id}`,
  };
}
