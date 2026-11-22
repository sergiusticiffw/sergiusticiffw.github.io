import "server-only";

import {
  EMPTY_HEALTH,
  type Appointment,
  type HealthData,
  type Measurement,
  type Medication,
  type Vaccination,
} from "@/lib/health-types";
import { createClient } from "@/lib/supabase/server";

function missingTable(code: string | undefined) {
  return code === "42P01" || code === "PGRST205";
}

/** Loads the four health lists for one person. RLS decides what is visible. */
export async function loadHealth(profileId: string): Promise<HealthData> {
  const supabase = await createClient();
  const [medications, appointments, vaccinations, measurements] =
    await Promise.all([
      supabase
        .from("medications")
        .select(
          "id, name, dose, schedule, prescribed_by, start_date, end_date, notes, source",
        )
        .eq("profile_id", profileId)
        .order("start_date", { ascending: false, nullsFirst: false })
        .limit(100),
      supabase
        .from("appointments")
        .select(
          "id, title, starts_at, doctor, location, notes, done_at, cancelled_at, source",
        )
        .eq("profile_id", profileId)
        .order("starts_at", { ascending: false })
        .limit(100),
      supabase
        .from("vaccinations")
        .select(
          "id, vaccine_name, given_on, dose_label, lot_number, administered_by, next_due_on, notes, source",
        )
        .eq("profile_id", profileId)
        .order("given_on", { ascending: false })
        .limit(100),
      supabase
        .from("measurements")
        .select(
          "id, kind, label, value, value_text, unit, measured_on, notes, source",
        )
        .eq("profile_id", profileId)
        .order("measured_on", { ascending: false })
        .limit(200),
    ]);

  const failed = [medications, appointments, vaccinations, measurements].find(
    (result) => result.error,
  );
  if (failed?.error) {
    if (!missingTable(failed.error.code)) {
      console.error("loadHealth", failed.error.code);
    }
    return EMPTY_HEALTH;
  }

  return {
    available: true,
    medications: (medications.data ?? []) as Medication[],
    appointments: (appointments.data ?? []) as Appointment[],
    vaccinations: (vaccinations.data ?? []) as Vaccination[],
    measurements: (measurements.data ?? []) as Measurement[],
  };
}
