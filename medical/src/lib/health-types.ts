import type { MeasurementKind } from "@/lib/validation/health";

export type Medication = {
  id: string;
  name: string;
  dose: string | null;
  schedule: string | null;
  prescribed_by: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  source: "family" | "document";
};

export type Appointment = {
  id: string;
  title: string;
  starts_at: string;
  doctor: string | null;
  location: string | null;
  notes: string | null;
  done_at: string | null;
  source: "family" | "document";
};

export type Vaccination = {
  id: string;
  vaccine_name: string;
  given_on: string;
  dose_label: string | null;
  lot_number: string | null;
  administered_by: string | null;
  next_due_on: string | null;
  notes: string | null;
  source: "family" | "document";
};

export type Measurement = {
  id: string;
  kind: MeasurementKind;
  label: string | null;
  value: number | string | null;
  value_text: string | null;
  unit: string | null;
  measured_on: string;
  notes: string | null;
  source: "family" | "document";
};

export type HealthData = {
  /** False when the health-tracking migration has not been applied. */
  available: boolean;
  medications: Medication[];
  appointments: Appointment[];
  vaccinations: Vaccination[];
  measurements: Measurement[];
};

export const EMPTY_HEALTH: HealthData = {
  available: false,
  medications: [],
  appointments: [],
  vaccinations: [],
  measurements: [],
};
