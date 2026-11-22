"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  addHealthEntry,
  deleteHealthEntry,
  setAppointmentCancelled,
  setAppointmentDone,
  updateHealthEntry,
} from "@/app/(app)/profiles/health-actions";
import { LabTrendChart } from "@/components/profiles/lab-history";
import { SourceBadge } from "@/components/records/source-badge";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatBirthDate } from "@/lib/format";
import type { Appointment, HealthData, Measurement } from "@/lib/health-types";
import type { LabSeries } from "@/lib/labs";
import {
  MEASUREMENT_DEFAULT_UNITS,
  MEASUREMENT_KINDS,
  MEASUREMENT_LABELS,
  type HealthKind,
  type MeasurementKind,
} from "@/lib/validation/health";

const DIALOG_TITLES: Record<HealthKind, string> = {
  medication: "Medicament nou",
  appointment: "Programare nouă",
  vaccination: "Vaccin nou",
  measurement: "Măsurătoare nouă",
};

const EDIT_TITLES: Record<HealthKind, string> = {
  medication: "Editează medicamentul",
  appointment: "Editează programarea",
  vaccination: "Editează vaccinul",
  measurement: "Editează măsurătoarea",
};

/** Medications tab hidden for now; backend data remains. */
const TABS = [
  { id: "appointments", label: "Programări" },
  { id: "vaccinations", label: "Vaccinuri" },
  { id: "measurements", label: "Măsurători" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const VISIBLE_ROWS = 5;

function countLabel(count: number, one: string, many: string) {
  if (count === 0) {
    return "";
  }
  return `${count} ${count === 1 ? one : many}`;
}

function todayValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

/** Date and time inputs in the browser's zone, matching how new appointments are read. */
function localDateTime(value: string) {
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function dateTime(value: string) {
  return new Date(value).toLocaleString("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Chisinau",
  });
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

function RowShell({
  children,
  onEdit,
  onDelete,
  canEdit,
  name,
  busy,
  deleteLabel = "Șterge",
}: {
  children: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
  name: string;
  busy: boolean;
  deleteLabel?: string;
}) {
  return (
    <li className="flex items-start justify-between gap-2 rounded-lg border bg-card px-2.5 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
      {canEdit && (onEdit || onDelete) ? (
        <div className="flex shrink-0 gap-1">
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`Editează ${name}`}
              onClick={onEdit}
            >
              <Pencil />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={busy}
              aria-label={`${deleteLabel} ${name}`}
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function TruncatedList({
  empty,
  items,
}: {
  empty: string;
  items: ReactNode[];
}) {
  const [expanded, setExpanded] = useState(false);
  const hidden = items.length - VISIBLE_ROWS;
  const shown = expanded || hidden <= 0 ? items : items.slice(0, VISIBLE_ROWS);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <ul className="flex flex-col gap-1.5">{shown}</ul>
      {hidden > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Arată mai puține" : `Arată toate (${items.length})`}
        </Button>
      ) : null}
    </div>
  );
}

function Subheading({ children }: { children: ReactNode }) {
  return (
    <h4 className="pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h4>
  );
}

function measurementSeries(items: Measurement[]): LabSeries[] {
  const map = new Map<string, LabSeries>();
  for (const item of items) {
    const value =
      item.value === null || item.value === undefined ? null : Number(item.value);
    const name =
      item.kind === "other" && item.label
        ? item.label
        : MEASUREMENT_LABELS[item.kind];
    const unit = item.unit ?? "";
    const key = `${item.kind}|${name}|${unit}`;
    let series = map.get(key);
    if (!series) {
      series = { key, name, unit, points: [] };
      map.set(key, series);
    }
    series.points.push({
      recordId: item.id,
      date: item.measured_on,
      value: Number.isFinite(value) ? value : null,
      text: item.value_text,
      referenceMin: null,
      referenceMax: null,
      referenceText: null,
    });
  }
  return [...map.values()];
}

function appointmentStatus(item: Appointment) {
  if (item.cancelled_at) {
    return "Anulată";
  }
  if (item.done_at) {
    return "Efectuată";
  }
  return null;
}

export function HealthTracking({
  profileId,
  health,
  canEdit,
}: {
  profileId: string;
  health: HealthData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [listOpen, setListOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("appointments");
  const [adding, setAdding] = useState<HealthKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [measurementKind, setMeasurementKind] =
    useState<MeasurementKind>("weight");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now] = useState(() => Date.now());
  const formId = `health-form-${profileId}`;

  if (!health.available) {
    return null;
  }

  async function run(action: () => Promise<{ error?: string }>) {
    setPending(true);
    setError(null);
    try {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Nu s-a putut salva. Încearcă din nou.");
      return false;
    } finally {
      setPending(false);
    }
  }

  function closeList() {
    if (pending) {
      return;
    }
    setListOpen(false);
    setError(null);
  }

  function close() {
    if (pending) {
      return;
    }
    setAdding(null);
    setEditingId(null);
    setMeasurementKind("weight");
    setError(null);
  }

  function openAdd(kind: HealthKind) {
    setError(null);
    setEditingId(null);
    setAdding(kind);
  }

  function openEdit(kind: HealthKind, id: string) {
    setError(null);
    if (kind === "measurement") {
      const item = health.measurements.find((entry) => entry.id === id);
      setMeasurementKind(item?.kind ?? "weight");
    }
    setEditingId(id);
    setAdding(kind);
  }

  async function submit(formData: FormData) {
    if (!adding) {
      return;
    }
    formData.set("profileId", profileId);
    if (editingId) {
      formData.set("id", editingId);
    }
    if (adding === "appointment") {
      const date = String(formData.get("date") ?? "");
      const time = String(formData.get("time") ?? "") || "09:00";
      const when = new Date(`${date}T${time}`);
      formData.set(
        "startsAt",
        Number.isNaN(when.getTime()) ? "" : when.toISOString(),
      );
    }
    const kind = adding;
    const saved = await run(() =>
      editingId ? updateHealthEntry(kind, formData) : addHealthEntry(kind, formData),
    );
    if (saved) {
      setAdding(null);
      setEditingId(null);
      setMeasurementKind("weight");
    }
  }

  function remove(kind: HealthKind, id: string) {
    void run(() => deleteHealthEntry(kind, profileId, id));
  }

  const upcoming = health.appointments
    .filter(
      (item) =>
        !item.done_at &&
        !item.cancelled_at &&
        new Date(item.starts_at).getTime() >= now,
    )
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = health.appointments
    .filter((item) => !upcoming.includes(item))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const series = measurementSeries(health.measurements);

  const editAppointment =
    adding === "appointment" && editingId
      ? health.appointments.find((item) => item.id === editingId)
      : undefined;
  const editAppointmentWhen = editAppointment
    ? localDateTime(editAppointment.starts_at)
    : null;
  const editVaccination =
    adding === "vaccination" && editingId
      ? health.vaccinations.find((item) => item.id === editingId)
      : undefined;
  const editMeasurement =
    adding === "measurement" && editingId
      ? health.measurements.find((item) => item.id === editingId)
      : undefined;
  const editNotes =
    editAppointment?.notes ??
    editVaccination?.notes ??
    editMeasurement?.notes ??
    "";

  const summary =
    [
      countLabel(upcoming.length, "programare", "programări"),
      countLabel(health.vaccinations.length, "vaccin", "vaccinuri"),
      countLabel(health.measurements.length, "măsurătoare", "măsurători"),
    ]
      .filter(Boolean)
      .join(" · ") || "Nimic notat încă";

  function appointmentRows(items: Appointment[]) {
    return items.map((item) => {
      const status = appointmentStatus(item);
      return (
        <RowShell
          key={item.id}
          name={item.title}
          canEdit={canEdit}
          busy={pending}
          onEdit={() => openEdit("appointment", item.id)}
          onDelete={() => remove("appointment", item.id)}
        >
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[
              dateTime(item.starts_at),
              item.doctor,
              item.location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <SourceBadge source={item.source === "document" ? "document" : "manual"} />
            {status ? <StatusBadge>{status}</StatusBadge> : null}
            {canEdit && !item.cancelled_at ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                loading={pending}
                onClick={() =>
                  void run(() =>
                    setAppointmentDone(profileId, item.id, !item.done_at),
                  )
                }
              >
                {item.done_at ? "Viitoare" : "Efectuată"}
              </Button>
            ) : null}
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                size="xs"
                loading={pending}
                onClick={() =>
                  void run(() =>
                    setAppointmentCancelled(
                      profileId,
                      item.id,
                      !item.cancelled_at,
                    ),
                  )
                }
              >
                {item.cancelled_at ? "Reactivează" : "Anulează"}
              </Button>
            ) : null}
          </div>
          {item.notes ? (
            <p className="truncate text-xs text-muted-foreground">{item.notes}</p>
          ) : null}
        </RowShell>
      );
    });
  }

  return (
    <section
      aria-labelledby={`health-${profileId}`}
      className="flex flex-col gap-3 border-t pt-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={`health-${profileId}`} className="text-base font-semibold">
            Programări, vaccinuri și măsurători
          </h2>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0"
          aria-haspopup="dialog"
          onClick={() => setListOpen(true)}
        >
          Deschide
        </Button>
      </div>

      <FormDialog
        open={listOpen}
        title="Urmărire sănătate"
        pending={pending}
        onClose={closeList}
      >
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Notate de familie, nu verificate de un medic.
          </p>
          {error && adding === null ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div
            role="tablist"
            aria-label="Secțiuni sănătate"
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {TABS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                className={`rounded-md px-1 py-1.5 text-center text-[0.7rem] font-medium transition-colors sm:text-xs ${
                  tab === entry.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "appointments" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Programări</h3>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openAdd("appointment")}
                  >
                    Adaugă
                  </Button>
                ) : null}
              </div>
              {health.appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nicio programare.</p>
              ) : (
                <>
                  {upcoming.length > 0 ? (
                    <>
                      <Subheading>Viitoare</Subheading>
                      <TruncatedList empty="" items={appointmentRows(upcoming)} />
                    </>
                  ) : null}
                  {past.length > 0 ? (
                    <>
                      <Subheading>Trecute / efectuate / anulate</Subheading>
                      <TruncatedList empty="" items={appointmentRows(past)} />
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {tab === "vaccinations" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Vaccinuri</h3>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openAdd("vaccination")}
                  >
                    Adaugă
                  </Button>
                ) : null}
              </div>
              <TruncatedList
                empty="Nicio vaccinare notată."
                items={health.vaccinations.map((item) => (
                  <RowShell
                    key={item.id}
                    name={item.vaccine_name}
                    canEdit={canEdit}
                    busy={pending}
                    onEdit={() => openEdit("vaccination", item.id)}
                    onDelete={() => remove("vaccination", item.id)}
                  >
                    <p className="truncate text-sm font-medium">
                      {item.vaccine_name}
                      {item.dose_label ? ` · ${item.dose_label}` : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[
                        formatBirthDate(item.given_on),
                        item.administered_by,
                        item.lot_number ? `lot ${item.lot_number}` : null,
                        item.next_due_on
                          ? `următoarea ${formatBirthDate(item.next_due_on)}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <SourceBadge
                      source={item.source === "document" ? "document" : "manual"}
                    />
                  </RowShell>
                ))}
              />
            </div>
          ) : null}

          {tab === "measurements" ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Măsurători</h3>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openAdd("measurement")}
                  >
                    Adaugă
                  </Button>
                ) : null}
              </div>
              <TruncatedList
                empty="Nicio măsurătoare notată."
                items={series.map((item) => {
                  const latest = item.points[0];
                  const shown =
                    latest.value !== null
                      ? String(latest.value)
                      : (latest.text ?? "—");
                  return (
                    <li key={item.key} className="rounded-lg border bg-card">
                      <details>
                        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {item.name}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {latest.date ? formatBirthDate(latest.date) : ""}
                              {item.points.length > 1
                                ? ` · ${item.points.length} valori`
                                : ""}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold">
                            {item.unit ? `${shown} ${item.unit}` : shown}
                          </span>
                        </summary>
                        <div className="flex flex-col gap-2 border-t px-2.5 py-2">
                          <LabTrendChart series={item} />
                          <ul className="flex flex-col gap-1 text-xs">
                            {item.points.map((point) => (
                              <li
                                key={point.recordId}
                                className="flex items-center justify-between gap-2 border-t py-1 first:border-t-0"
                              >
                                <span className="truncate">
                                  {point.date
                                    ? formatBirthDate(point.date)
                                    : "Fără dată"}
                                  {" · "}
                                  {point.value !== null ? point.value : point.text}
                                  {item.unit ? ` ${item.unit}` : ""}
                                </span>
                                {canEdit ? (
                                  <span className="flex shrink-0 gap-1">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={pending}
                                      aria-label={`Editează valoarea din ${point.date ?? "fără dată"}`}
                                      onClick={() =>
                                        openEdit("measurement", point.recordId)
                                      }
                                    >
                                      <Pencil />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon-sm"
                                      disabled={pending}
                                      aria-label={`Șterge valoarea din ${point.date ?? "fără dată"}`}
                                      onClick={() =>
                                        remove("measurement", point.recordId)
                                      }
                                    >
                                      <Trash2 />
                                    </Button>
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    </li>
                  );
                })}
              />
            </div>
          ) : null}
        </div>
      </FormDialog>

      <FormDialog
        open={adding !== null}
        title={adding ? (editingId ? EDIT_TITLES : DIALOG_TITLES)[adding] : ""}
        pending={pending}
        onClose={close}
        footer={
          <>
            <Button type="button" variant="outline" disabled={pending} onClick={close}>
              Renunță
            </Button>
            <Button type="submit" form={formId} loading={pending}>
              {pending ? "Se salvează…" : "Salvează"}
            </Button>
          </>
        }
      >
        {adding ? (
          <form
            key={`${adding}-${editingId ?? "new"}`}
            id={formId}
            action={submit}
            className="flex flex-col gap-3"
          >
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {adding === "appointment" ? (
              <>
                <Field id={`${formId}-title`} label="Titlu">
                  <Input id={`${formId}-title`} name="title" required maxLength={160} autoComplete="off" placeholder="ex. Control cardiologie" defaultValue={editAppointment?.title ?? ""} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field id={`${formId}-date`} label="Data">
                    <Input id={`${formId}-date`} name="date" type="date" required defaultValue={editAppointmentWhen?.date ?? todayValue()} />
                  </Field>
                  <Field id={`${formId}-time`} label="Ora">
                    <Input id={`${formId}-time`} name="time" type="time" defaultValue={editAppointmentWhen?.time ?? "09:00"} />
                  </Field>
                </div>
                <Field id={`${formId}-doctor`} label="Medic">
                  <Input id={`${formId}-doctor`} name="doctor" maxLength={160} autoComplete="off" defaultValue={editAppointment?.doctor ?? ""} />
                </Field>
                <Field id={`${formId}-location`} label="Loc">
                  <Input id={`${formId}-location`} name="location" maxLength={200} autoComplete="off" defaultValue={editAppointment?.location ?? ""} />
                </Field>
              </>
            ) : null}
            {adding === "vaccination" ? (
              <>
                <Field id={`${formId}-vaccine`} label="Vaccin">
                  <Input id={`${formId}-vaccine`} name="vaccineName" required maxLength={160} autoComplete="off" defaultValue={editVaccination?.vaccine_name ?? ""} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field id={`${formId}-given`} label="Data">
                    <Input id={`${formId}-given`} name="givenOn" type="date" required defaultValue={editVaccination?.given_on ?? todayValue()} />
                  </Field>
                  <Field id={`${formId}-dose-label`} label="Doza">
                    <Input id={`${formId}-dose-label`} name="doseLabel" maxLength={80} autoComplete="off" placeholder="ex. doza 2" defaultValue={editVaccination?.dose_label ?? ""} />
                  </Field>
                </div>
                <Field id={`${formId}-lot`} label="Lot">
                  <Input id={`${formId}-lot`} name="lotNumber" maxLength={80} autoComplete="off" defaultValue={editVaccination?.lot_number ?? ""} />
                </Field>
                <Field id={`${formId}-admin`} label="Administrat de">
                  <Input id={`${formId}-admin`} name="administeredBy" maxLength={160} autoComplete="off" defaultValue={editVaccination?.administered_by ?? ""} />
                </Field>
                <Field id={`${formId}-next`} label="Următoarea doză (dacă ți-a spus medicul)">
                  <Input id={`${formId}-next`} name="nextDueOn" type="date" defaultValue={editVaccination?.next_due_on ?? ""} />
                </Field>
              </>
            ) : null}
            {adding === "measurement" ? (
              <>
                <Field id={`${formId}-kind`} label="Tip">
                  <Select
                    id={`${formId}-kind`}
                    name="measurementKind"
                    value={measurementKind}
                    onChange={(event) =>
                      setMeasurementKind(event.target.value as MeasurementKind)
                    }
                  >
                    {MEASUREMENT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {MEASUREMENT_LABELS[kind]}
                      </option>
                    ))}
                  </Select>
                </Field>
                {measurementKind === "other" ? (
                  <Field id={`${formId}-label`} label="Denumire">
                    <Input id={`${formId}-label`} name="label" maxLength={80} autoComplete="off" defaultValue={editMeasurement?.label ?? ""} />
                  </Field>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Field id={`${formId}-value`} label="Valoare">
                    <Input
                      id={`${formId}-value`}
                      name="value"
                      required
                      maxLength={40}
                      autoComplete="off"
                      inputMode="decimal"
                      placeholder={measurementKind === "blood_pressure" ? "120/80" : ""}
                      defaultValue={
                        editMeasurement
                          ? (editMeasurement.value_text ??
                            (editMeasurement.value === null ? "" : String(editMeasurement.value)))
                          : ""
                      }
                    />
                  </Field>
                  <Field id={`${formId}-unit`} label="Unitate">
                    <Input
                      key={measurementKind}
                      id={`${formId}-unit`}
                      name="unit"
                      maxLength={20}
                      autoComplete="off"
                      defaultValue={
                        editMeasurement && editMeasurement.kind === measurementKind
                          ? (editMeasurement.unit ?? "")
                          : MEASUREMENT_DEFAULT_UNITS[measurementKind]
                      }
                    />
                  </Field>
                </div>
                <Field id={`${formId}-on`} label="Data">
                  <Input id={`${formId}-on`} name="measuredOn" type="date" required defaultValue={editMeasurement?.measured_on ?? todayValue()} />
                </Field>
              </>
            ) : null}
            <Field id={`${formId}-notes`} label="Notă (opțional)">
              <Textarea id={`${formId}-notes`} name="notes" maxLength={1000} className="min-h-20" defaultValue={editNotes} />
            </Field>
          </form>
        ) : null}
      </FormDialog>
    </section>
  );
}
