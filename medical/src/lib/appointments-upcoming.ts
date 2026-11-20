import "server-only";

import { createClient } from "@/lib/supabase/server";

export type UpcomingAppointment = {
  id: string;
  profile_id: string;
  title: string;
  starts_at: string;
};

const WINDOW_MS = 48 * 60 * 60 * 1000;

function missingTable(code: string | undefined) {
  return code === "42P01" || code === "PGRST205";
}

/** Open appointments starting in the next 48 hours. RLS decides what is visible. */
export async function loadUpcomingAppointments(
  now: Date = new Date(),
): Promise<UpcomingAppointment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("appointments")
    .select("id, profile_id, title, starts_at")
    .is("done_at", null)
    .gte("starts_at", now.toISOString())
    .lt("starts_at", new Date(now.getTime() + WINDOW_MS).toISOString())
    .order("starts_at", { ascending: true })
    .limit(20);

  if (error) {
    if (!missingTable(error.code)) {
      console.error("loadUpcomingAppointments", error.code);
    }
    return [];
  }
  return (data ?? []) as UpcomingAppointment[];
}
