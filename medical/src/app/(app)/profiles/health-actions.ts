"use server";

import { requireProfileWriter } from "@/lib/auth";
import { revalidateMedicalData } from "@/lib/data-cache";
import { createClient } from "@/lib/supabase/server";
import {
  appointmentSchema,
  HEALTH_KINDS,
  measurementSchema,
  medicationSchema,
  splitMeasurement,
  vaccinationSchema,
  type HealthKind,
} from "@/lib/validation/health";
import { profileIdSchema } from "@/lib/validation/profile";

export type HealthActionResult = {
  error?: string;
  saved?: boolean;
};

const TABLES: Record<HealthKind, string> = {
  medication: "medications",
  appointment: "appointments",
  vaccination: "vaccinations",
  measurement: "measurements",
};

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

function blank(value: string) {
  return value.trim() === "" ? null : value.trim();
}

function missingTable(code: string | undefined) {
  return code === "42P01" || code === "PGRST205";
}

function healthRow(
  kind: HealthKind,
  formData: FormData,
): { row: Record<string, unknown> } | { error: string } {
  let row: Record<string, unknown>;
  if (kind === "medication") {
    const parsed = medicationSchema.safeParse({
      name: field(formData, "name"),
      dose: field(formData, "dose"),
      schedule: field(formData, "schedule"),
      prescribedBy: field(formData, "prescribedBy"),
      startDate: field(formData, "startDate"),
      endDate: field(formData, "endDate"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Verifică datele." };
    }
    const data = parsed.data;
    row = {
      name: data.name,
      dose: blank(data.dose),
      schedule: blank(data.schedule),
      prescribed_by: blank(data.prescribedBy),
      start_date: blank(data.startDate),
      end_date: blank(data.endDate),
      notes: blank(data.notes),
    };
  } else if (kind === "appointment") {
    const parsed = appointmentSchema.safeParse({
      title: field(formData, "title"),
      startsAt: field(formData, "startsAt"),
      doctor: field(formData, "doctor"),
      location: field(formData, "location"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Verifică datele." };
    }
    const data = parsed.data;
    row = {
      title: data.title,
      starts_at: new Date(data.startsAt).toISOString(),
      doctor: blank(data.doctor),
      location: blank(data.location),
      notes: blank(data.notes),
    };
  } else if (kind === "vaccination") {
    const parsed = vaccinationSchema.safeParse({
      vaccineName: field(formData, "vaccineName"),
      givenOn: field(formData, "givenOn"),
      doseLabel: field(formData, "doseLabel"),
      lotNumber: field(formData, "lotNumber"),
      administeredBy: field(formData, "administeredBy"),
      nextDueOn: field(formData, "nextDueOn"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Verifică datele." };
    }
    const data = parsed.data;
    row = {
      vaccine_name: data.vaccineName,
      given_on: data.givenOn,
      dose_label: blank(data.doseLabel),
      lot_number: blank(data.lotNumber),
      administered_by: blank(data.administeredBy),
      next_due_on: blank(data.nextDueOn),
      notes: blank(data.notes),
    };
  } else {
    const parsed = measurementSchema.safeParse({
      kind: field(formData, "measurementKind"),
      label: field(formData, "label"),
      value: field(formData, "value"),
      unit: field(formData, "unit"),
      measuredOn: field(formData, "measuredOn"),
      notes: field(formData, "notes"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Verifică datele." };
    }
    const data = parsed.data;
    const split = splitMeasurement(data.value);
    row = {
      kind: data.kind,
      label: blank(data.label),
      value: split.value,
      value_text: split.valueText,
      unit: blank(data.unit),
      measured_on: data.measuredOn,
      notes: blank(data.notes),
    };
  }
  return { row };
}

/** Everything saved here was typed by a family member; `source` records that. */
export async function addHealthEntry(
  kind: HealthKind,
  formData: FormData,
): Promise<HealthActionResult> {
  const parsedId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!parsedId.success || !HEALTH_KINDS.includes(kind)) {
    return { error: "Verifică datele introduse." };
  }
  const profileId = parsedId.data;

  const parsed = healthRow(kind, formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }
  const { row } = parsed;

  const writer = await requireProfileWriter(profileId);
  if (!writer.familyId) {
    return { error: writer.error ?? "Nu ai dreptul să modifici această persoană." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES[kind])
    .insert({ ...row, profile_id: profileId, source: "family" });
  if (error) {
    console.error("addHealthEntry", kind, error.code);
    return {
      error: missingTable(error.code)
        ? "Funcția nu este activată încă. Aplică migrația pentru urmărirea sănătății."
        : "Nu s-a putut salva. Încearcă din nou.",
    };
  }

  revalidateMedicalData(profileId);
  return { saved: true };
}

/** Replaces the editable fields of one entry; `source` and `done_at` stay as they were. */
export async function updateHealthEntry(
  kind: HealthKind,
  formData: FormData,
): Promise<HealthActionResult> {
  const parsedId = profileIdSchema.safeParse(formData.get("profileId"));
  const parsedEntry = profileIdSchema.safeParse(formData.get("id"));
  if (!parsedId.success || !parsedEntry.success || !HEALTH_KINDS.includes(kind)) {
    return { error: "Verifică datele introduse." };
  }

  const parsed = healthRow(kind, formData);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const writer = await requireProfileWriter(parsedId.data);
  if (!writer.familyId) {
    return { error: writer.error ?? "Nu ai dreptul să modifici această persoană." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(TABLES[kind])
    .update(parsed.row)
    .eq("id", parsedEntry.data)
    .eq("profile_id", parsedId.data)
    .select("id");
  if (error) {
    console.error("updateHealthEntry", kind, error.code);
    return { error: "Nu s-a putut salva. Încearcă din nou." };
  }
  if (!data || data.length === 0) {
    return { error: "Înregistrarea nu mai există sau nu ai dreptul să o modifici." };
  }

  revalidateMedicalData(parsedId.data);
  return { saved: true };
}

export async function deleteHealthEntry(
  kind: HealthKind,
  profileId: string,
  id: string,
): Promise<HealthActionResult> {
  const parsedId = profileIdSchema.safeParse(profileId);
  const parsedEntry = profileIdSchema.safeParse(id);
  if (!parsedId.success || !parsedEntry.success || !HEALTH_KINDS.includes(kind)) {
    return { error: "Verifică datele introduse." };
  }

  const writer = await requireProfileWriter(parsedId.data);
  if (!writer.familyId) {
    return { error: writer.error ?? "Nu ai dreptul să modifici această persoană." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLES[kind])
    .delete()
    .eq("id", parsedEntry.data)
    .eq("profile_id", parsedId.data);
  if (error) {
    console.error("deleteHealthEntry", kind, error.code);
    return { error: "Nu s-a putut șterge. Încearcă din nou." };
  }

  revalidateMedicalData(parsedId.data);
  return { saved: true };
}

export async function setAppointmentDone(
  profileId: string,
  id: string,
  done: boolean,
): Promise<HealthActionResult> {
  const parsedId = profileIdSchema.safeParse(profileId);
  const parsedEntry = profileIdSchema.safeParse(id);
  if (!parsedId.success || !parsedEntry.success) {
    return { error: "Verifică datele introduse." };
  }

  const writer = await requireProfileWriter(parsedId.data);
  if (!writer.familyId) {
    return { error: writer.error ?? "Nu ai dreptul să modifici această persoană." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update(
      done
        ? { done_at: new Date().toISOString(), cancelled_at: null }
        : { done_at: null },
    )
    .eq("id", parsedEntry.data)
    .eq("profile_id", parsedId.data);
  if (error) {
    console.error("setAppointmentDone", error.code);
    return { error: "Nu s-a putut actualiza. Încearcă din nou." };
  }

  revalidateMedicalData(parsedId.data);
  return { saved: true };
}

export async function setAppointmentCancelled(
  profileId: string,
  id: string,
  cancelled: boolean,
): Promise<HealthActionResult> {
  const parsedId = profileIdSchema.safeParse(profileId);
  const parsedEntry = profileIdSchema.safeParse(id);
  if (!parsedId.success || !parsedEntry.success) {
    return { error: "Verifică datele introduse." };
  }

  const writer = await requireProfileWriter(parsedId.data);
  if (!writer.familyId) {
    return { error: writer.error ?? "Nu ai dreptul să modifici această persoană." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("appointments")
    .update(
      cancelled
        ? { cancelled_at: new Date().toISOString(), done_at: null }
        : { cancelled_at: null },
    )
    .eq("id", parsedEntry.data)
    .eq("profile_id", parsedId.data);
  if (error) {
    console.error("setAppointmentCancelled", error.code);
    return { error: "Nu s-a putut actualiza. Încearcă din nou." };
  }

  revalidateMedicalData(parsedId.data);
  return { saved: true };
}

function todayDateChisinau() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Chisinau",
  }).format(new Date());
}

/** Sets end_date so the medication leaves the active list. */
export async function stopMedication(
  profileId: string,
  id: string,
  endDate?: string,
): Promise<HealthActionResult> {
  const parsedId = profileIdSchema.safeParse(profileId);
  const parsedEntry = profileIdSchema.safeParse(id);
  if (!parsedId.success || !parsedEntry.success) {
    return { error: "Verifică datele introduse." };
  }

  const writer = await requireProfileWriter(parsedId.data);
  if (!writer.familyId) {
    return { error: writer.error ?? "Nu ai dreptul să modifici această persoană." };
  }

  const date =
    endDate && /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ? endDate
      : todayDateChisinau();

  const supabase = await createClient();
  const { error } = await supabase
    .from("medications")
    .update({ end_date: date })
    .eq("id", parsedEntry.data)
    .eq("profile_id", parsedId.data);
  if (error) {
    console.error("stopMedication", error.code);
    return { error: "Nu s-a putut opri medicamentul. Încearcă din nou." };
  }

  revalidateMedicalData(parsedId.data);
  return { saved: true };
}

/** Clears end_date so the medication returns to the active list. */
export async function reactivateMedication(
  profileId: string,
  id: string,
): Promise<HealthActionResult> {
  const parsedId = profileIdSchema.safeParse(profileId);
  const parsedEntry = profileIdSchema.safeParse(id);
  if (!parsedId.success || !parsedEntry.success) {
    return { error: "Verifică datele introduse." };
  }

  const writer = await requireProfileWriter(parsedId.data);
  if (!writer.familyId) {
    return { error: writer.error ?? "Nu ai dreptul să modifici această persoană." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("medications")
    .update({ end_date: null })
    .eq("id", parsedEntry.data)
    .eq("profile_id", parsedId.data);
  if (error) {
    console.error("reactivateMedication", error.code);
    return { error: "Nu s-a putut reactiva medicamentul. Încearcă din nou." };
  }

  revalidateMedicalData(parsedId.data);
  return { saved: true };
}
