import { z } from "zod";

export const HEALTH_KINDS = [
  "medication",
  "appointment",
  "vaccination",
  "measurement",
] as const;
export type HealthKind = (typeof HEALTH_KINDS)[number];

export const MEASUREMENT_KINDS = [
  "weight",
  "height",
  "temperature",
  "blood_pressure",
  "pulse",
  "glucose",
  "other",
] as const;
export type MeasurementKind = (typeof MEASUREMENT_KINDS)[number];

export const MEASUREMENT_LABELS: Record<MeasurementKind, string> = {
  weight: "Greutate",
  height: "Înălțime",
  temperature: "Temperatură",
  blood_pressure: "Tensiune",
  pulse: "Puls",
  glucose: "Glicemie",
  other: "Altă măsurătoare",
};

export const MEASUREMENT_DEFAULT_UNITS: Record<MeasurementKind, string> = {
  weight: "kg",
  height: "cm",
  temperature: "°C",
  blood_pressure: "mmHg",
  pulse: "bpm",
  glucose: "mg/dL",
  other: "",
};

const text = (max: number) => z.string().trim().max(max);
const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => {
      if (value === "") {
        return true;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
      }
      const date = new Date(`${value}T00:00:00Z`);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    },
    { message: "Data nu este validă." },
  );
const requiredDate = optionalDate.refine((value) => value !== "", {
  message: "Data este obligatorie.",
});

export const medicationSchema = z
  .object({
    name: text(160).min(1, "Numele este obligatoriu."),
    dose: text(120),
    schedule: text(200),
    prescribedBy: text(160),
    startDate: optionalDate,
    endDate: optionalDate,
    notes: text(2000),
  })
  .refine((value) => !value.startDate || !value.endDate || value.endDate >= value.startDate, {
    message: "Data de final nu poate fi înaintea celei de început.",
  });

export const appointmentSchema = z.object({
  title: text(160).min(1, "Titlul este obligatoriu."),
  startsAt: z
    .string()
    .trim()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), {
      message: "Data și ora nu sunt valide.",
    }),
  doctor: text(160),
  location: text(200),
  notes: text(2000),
});

export const vaccinationSchema = z.object({
  vaccineName: text(160).min(1, "Numele vaccinului este obligatoriu."),
  givenOn: requiredDate,
  doseLabel: text(80),
  lotNumber: text(80),
  administeredBy: text(160),
  nextDueOn: optionalDate,
  notes: text(2000),
});

export const measurementSchema = z.object({
  kind: z.enum(MEASUREMENT_KINDS),
  label: text(80),
  value: text(40).min(1, "Valoarea este obligatorie."),
  unit: text(20),
  measuredOn: requiredDate,
  notes: text(1000),
});

/** Plain numbers are stored as numbers; anything else (e.g. 120/80) as text. */
export function splitMeasurement(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return { value: Number(normalized), valueText: null as string | null };
  }
  return { value: null as number | null, valueText: value.trim() };
}
