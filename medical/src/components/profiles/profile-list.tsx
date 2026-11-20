"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { deleteProfile } from "@/app/(app)/profiles/actions";
import { HealthTracking } from "@/components/profiles/health-tracking";
import { LabHistory } from "@/components/profiles/lab-history";
import { ProfileEntries } from "@/components/profiles/profile-entries";
import { ProfileForm } from "@/components/profiles/profile-form";
import { type ProfileIdentityDoc } from "@/components/profiles/profile-identity-docs";
import {
  InsuranceExpiryBanner,
  ProfileInsuranceSection,
  type ProfileInsurance,
} from "@/components/profiles/profile-insurance";
import {
  EmergencyCard,
} from "@/components/profiles/emergency-card";
import { RecordRow } from "@/components/records/record-row";
import type { RecordSource } from "@/components/records/source-badge";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatAge, formatBirthDate, maskIdnp } from "@/lib/format";
import { EMPTY_HEALTH, type HealthData } from "@/lib/health-types";
import {
  parseRecordCategory,
  RECORD_CATEGORIES,
  type RecordCategory,
} from "@/lib/record-category";
import { requireSensitiveUnlock } from "@/lib/sensitive-action";
import { foldText, groupByMonth } from "@/lib/timeline";

const PAGE_SIZE = 10;

export type MedicalProfile = {
  id: string;
  display_name: string;
  birth_date: string | null;
  idnp: string | null;
  notes: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  blood_type: string | null;
  emergency_notes: string | null;
};

export type MedicalDocument = {
  id: string;
  profile_id: string;
  original_filename: string;
  document_date: string | null;
  category: string | null;
  title: string | null;
  record_id: string | null;
};

export type MedicalConsultation = {
  id: string;
  profile_id: string;
  source_document_id: string | null;
  consultation_date: string;
  doctor_name: string | null;
  summary: string | null;
};

export type MedicalLabTest = {
  id: string;
  profile_id: string;
  source_document_id: string | null;
  test_name: string;
  sample_date: string | null;
  result_value?: number | string | null;
  result_text?: string | null;
  unit?: string | null;
  reference_min?: number | string | null;
  reference_max?: number | string | null;
  reference_text?: string | null;
};

export function ProfileList({
  profiles,
  emptyAction,
}: {
  profiles: MedicalProfile[];
  emptyAction?: ReactNode;
}) {
  if (profiles.length === 0) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-dashed px-4 py-6">
        <p className="text-sm text-muted-foreground">
          Nu există persoane încă. Adaugă prima persoană din familie ca să poți
          încărca documente.
        </p>
        {emptyAction}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {profiles.map((profile) => (
        <li key={profile.id}>
          <Link
            href={`/profiles/${profile.id}`}
            prefetch
            className="flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <Avatar name={profile.display_name} />
            <span className="min-w-0">
              <span className="block truncate text-base font-medium">
                {profile.display_name}
              </span>
              <span className="block text-sm text-muted-foreground">
                {[
                  formatAge(profile.birth_date),
                  profile.idnp ? `IDNP ${maskIdnp(profile.idnp)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || formatBirthDate(profile.birth_date) || "Fără date"}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProfileDetail({
  profile,
  documents,
  consultations,
  labTests,
  insurances = [],
  identityDocs = [],
  driveConnected,
  canWrite = true,
  canEditRecords = canWrite,
  isAdmin = true,
  health = EMPTY_HEALTH,
}: {
  health?: HealthData;
  profile: MedicalProfile;
  documents: MedicalDocument[];
  consultations: MedicalConsultation[];
  labTests: MedicalLabTest[];
  insurances?: ProfileInsurance[];
  identityDocs?: ProfileIdentityDoc[];
  driveConnected: boolean;
  canWrite?: boolean;
  canEditRecords?: boolean;
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const editFormId = `edit-profile-${profile.id}`;
  const [showIdnp, setShowIdnp] = useState(false);
  const birthDate = formatBirthDate(profile.birth_date);
  const age = formatAge(profile.birth_date);

  async function onDelete() {
    setPending(true);
    setError(null);
    const unlock = await requireSensitiveUnlock();
    if (unlock.error) {
      setError(unlock.error);
      setPending(false);
      return;
    }
    const result = await deleteProfile(profile.id);
    if (result.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar name={profile.display_name} size="lg" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">
              {profile.display_name}
            </h1>
            <p className="text-base text-muted-foreground">
              {[age, birthDate].filter(Boolean).join(" · ") || "Data nașterii nesetată"}
            </p>
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>
                {profile.idnp
                  ? `IDNP ${showIdnp ? profile.idnp : maskIdnp(profile.idnp)}`
                  : "IDNP nesetat"}
              </span>
              {profile.idnp ? (
                <button
                  type="button"
                  aria-pressed={showIdnp}
                  className="inline-flex min-h-11 items-center px-1 underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  onClick={() => setShowIdnp((value) => !value)}
                >
                  {showIdnp ? "Ascunde" : "Arată"}
                </button>
              ) : null}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <EmergencyCard
          info={profile}
          onEdit={canWrite ? () => setEditing(true) : undefined}
        />
        {profile.notes ? (
          <p className="whitespace-pre-wrap text-base">{profile.notes}</p>
        ) : null}
        <InsuranceExpiryBanner insurances={insurances} />
        <FormDialog
          open={editing}
          title="Modifică profilul"
          pending={editPending}
          onClose={() => {
            if (!editPending) setEditing(false);
          }}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={editPending}
                onClick={() => setEditing(false)}
              >
                Renunță
              </Button>
              <Button
                type="submit"
                form={editFormId}
                className="h-11 sm:w-fit"
                disabled={editPending}
              >
                {editPending ? "Se salvează…" : "Salvează"}
              </Button>
            </>
          }
        >
          <ProfileForm
            key={editing ? `edit-${profile.id}-${identityDocs[0]?.id ?? "none"}` : "closed"}
            profileId={profile.id}
            formId={editFormId}
            submitLabel="Salvează"
            hideActions
            identityDoc={identityDocs[0] ?? null}
            driveConnected={driveConnected}
            defaultValues={{
              displayName: profile.display_name,
              birthDate: profile.birth_date ?? "",
              idnp: profile.idnp ?? "",
              notes: profile.notes ?? "",
              allergies: profile.allergies ?? "",
              chronicConditions: profile.chronic_conditions ?? "",
              currentMedications: profile.current_medications ?? "",
              bloodType: profile.blood_type ?? "",
              emergencyNotes: profile.emergency_notes ?? "",
            }}
            onDone={() => setEditing(false)}
            onPendingChange={setEditPending}
          />
        </FormDialog>
        <ConfirmDialog
          open={confirmingDelete}
          title={`Ștergi profilul „${profile.display_name}”?`}
          description="Se șterge tot istoricul asociat: consultațiile, analizele și fișierele din Google Drive. Acțiunea nu poate fi anulată."
          confirmLabel="Șterge profilul"
          pending={pending}
          error={error}
          onConfirm={() => {
            void onDelete();
          }}
          onCancel={() => setConfirmingDelete(false)}
        />
        {canEditRecords ? (
        <ProfileEntries
          profileId={profile.id}
          profileName={profile.display_name}
          idnp={profile.idnp}
          driveConnected={driveConnected}
          canConnectDrive={isAdmin}
        />
        ) : null}
        <ProfileInsuranceSection
          identityDocs={identityDocs}
          profileId={profile.id}
          insurances={insurances}
          driveConnected={driveConnected}
          canEdit={canEditRecords}
        />
        <Link
          href={`/assistant?person=${profile.id}`}
          className="flex min-h-14 flex-col justify-center rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="text-base font-semibold">Pregătește vizita la medic</span>
          <span className="text-sm text-muted-foreground">
            Rezumat generat de AI din dosar, cu surse. Îl alegi tu și îl verifici.
          </span>
        </Link>
        <HealthTracking
          profileId={profile.id}
          health={health}
          canEdit={canEditRecords}
        />
        <LabHistory
          rows={labTests.map((item) => ({
            id: item.id,
            source_document_id: item.source_document_id,
            test_name: item.test_name,
            sample_date: item.sample_date,
            result_value: item.result_value ?? null,
            result_text: item.result_text ?? null,
            unit: item.unit ?? null,
            reference_min: item.reference_min ?? null,
            reference_max: item.reference_max ?? null,
            reference_text: item.reference_text ?? null,
          }))}
        />
        <ProfileRecords
          profileId={profile.id}
          documents={documents}
          consultations={consultations}
          labTests={labTests}
        />
        {canWrite ? (
          <div className="flex flex-col gap-2 border-t pt-4">
            <h2 className="text-base font-semibold">Gestionează persoana</h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(true)}
              >
                Modifică datele
              </Button>
              {isAdmin ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    setConfirmingDelete(true);
                  }}
                >
                  {pending ? "Se șterge…" : "Șterge persoana"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProfileRecords({
  profileId,
  documents,
  consultations,
  labTests,
}: {
  profileId: string;
  documents: MedicalDocument[];
  consultations: MedicalConsultation[];
  labTests: MedicalLabTest[];
}) {
  const primaries = documents.filter(
    (document) =>
      !document.record_id &&
      document.category !== "Asigurare" &&
      document.category !== "Act",
  );
  const documentRecords = primaries.map((document) => {
    const files = [
      document,
      ...documents.filter((item) => item.record_id === document.id),
    ];
    return {
      id: document.id,
      date: document.document_date,
      title:
        document.title?.trim() ||
        [
          document.category,
          files.length > 1 ? `${files.length} fișiere` : document.original_filename,
        ]
          .filter(Boolean)
          .join(" · "),
      body:
        consultations.find((item) => item.source_document_id === document.id)
          ?.summary ??
        labTests
          .filter((item) => item.source_document_id === document.id)
          .map((item) => item.test_name)
          .join(" · "),
      category: parseRecordCategory(
        document.category ||
          (labTests.some((item) => item.source_document_id === document.id)
            ? "Analiză"
            : "Consultație"),
      ),
      source: "document" as RecordSource,
      fileCount: files.length,
    };
  });
  const manualRecords = [
    ...consultations
      .filter((item) => !item.source_document_id)
      .map((item) => {
        const summary = item.summary?.trim() || "";
        const firstLine = summary.split("\n")[0]?.trim() || "";
        const rest = summary.includes("\n\n")
          ? summary.slice(summary.indexOf("\n\n") + 2).trim()
          : summary === firstLine
            ? ""
            : summary.slice(firstLine.length).trim();
        return {
          id: item.id,
          date: item.consultation_date,
          title:
            firstLine ||
            ["Consultație", item.doctor_name].filter(Boolean).join(" · "),
          body: rest,
          category: parseRecordCategory("Consultație"),
          source: "manual" as RecordSource,
          fileCount: 0,
        };
      }),
    ...labTests
      .filter((item) => !item.source_document_id)
      .map((item) => ({
        id: item.id,
        date: item.sample_date,
        title: item.test_name || "Analiză",
        body: "",
        category: parseRecordCategory("Analiză"),
        source: "manual" as RecordSource,
        fileCount: 0,
      })),
  ];
  const records = [...documentRecords, ...manualRecords].sort((left, right) => {
    if (left.date === right.date) {
      return left.title.localeCompare(right.title, "ro");
    }
    if (!left.date) {
      return 1;
    }
    if (!right.date) {
      return -1;
    }
    return right.date.localeCompare(left.date);
  });
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | RecordCategory>("");
  const [page, setPage] = useState(0);

  const needle = foldText(query.trim());
  const matched = records.filter((record) => {
    if (typeFilter && record.category !== typeFilter) {
      return false;
    }
    return !needle || foldText(`${record.title} ${record.body}`).includes(needle);
  });
  const pageCount = Math.max(1, Math.ceil(matched.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = matched.slice(
    current * PAGE_SIZE,
    current * PAGE_SIZE + PAGE_SIZE,
  );
  const groups = groupByMonth(visible);
  const filtered = Boolean(needle || typeFilter);

  const recordsLabel =
    matched.length === records.length
      ? records.length === 1
        ? "1 înregistrare"
        : `${records.length} înregistrări`
      : `${matched.length} din ${records.length} înregistrări`;

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Istoric</h2>
        {records.length > 0 ? (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {recordsLabel}
          </p>
        ) : null}
      </div>
      {records.length > 4 ? (
        <div role="search" className="flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`history-search-${profileId}`}>Caută în istoric</Label>
            <Input
              id={`history-search-${profileId}`}
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={query}
              placeholder="Doctor, analiză, text…"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="flex flex-col gap-1 sm:w-44">
            <Label htmlFor={`history-type-${profileId}`}>Tip</Label>
            <Select
              id={`history-type-${profileId}`}
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value as "" | RecordCategory);
                setPage(0);
              }}
            >
              <option value="">Toate</option>
              {RECORD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}
      {records.length === 0 ? (
        <p className="text-base text-muted-foreground">
          Nicio înregistrare pentru această persoană.
        </p>
      ) : matched.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-base text-muted-foreground">
            Nimic găsit pentru aceste filtre.
          </p>
          {filtered ? (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => {
                setQuery("");
                setTypeFilter("");
                setPage(0);
              }}
            >
              Șterge filtrele
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <section
              key={group.key}
              aria-labelledby={`history-${profileId}-${group.key}`}
              className="flex flex-col gap-2"
            >
              <h3
                id={`history-${profileId}-${group.key}`}
                className="text-sm font-semibold text-muted-foreground"
              >
                {group.label}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((record) => (
                  <li key={record.id}>
                    <RecordRow
                      record={{
                        id: record.id,
                        title: record.title,
                        date: record.date,
                        category: record.category,
                        snippet: record.body,
                        fileCount: record.fileCount,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Link
        href={`/records?person=${profileId}`}
        className="inline-flex min-h-11 w-fit items-center text-sm underline underline-offset-4"
      >
        Caută în tot dosarul acestei persoane
      </Link>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {current + 1} din {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Înapoi
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={current >= pageCount - 1}
              onClick={() => setPage(current + 1)}
            >
              Înainte
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

