"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

import { deleteProfile } from "@/app/(app)/profiles/actions";
import { ProfileEntries } from "@/components/profiles/profile-entries";
import { ProfileForm } from "@/components/profiles/profile-form";
import { type ProfileIdentityDoc } from "@/components/profiles/profile-identity-docs";
import {
  InsuranceExpiryBanner,
  ProfileInsuranceSection,
  type ProfileInsurance,
} from "@/components/profiles/profile-insurance";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { formatBirthDate } from "@/lib/format";
import { requireSensitiveUnlock } from "@/lib/sensitive-action";

const PAGE_SIZE = 5;

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
            className="block rounded-lg border p-4 hover:bg-muted"
          >
            <p className="font-medium">{profile.display_name}</p>
            <p className="text-sm text-muted-foreground">
              {[
                formatBirthDate(profile.birth_date),
                profile.idnp ? `IDNP ${profile.idnp}` : "IDNP nesetat",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
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
}: {
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
  const birthDate = formatBirthDate(profile.birth_date);

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
        <CardTitle>{profile.display_name}</CardTitle>
        <CardDescription>
          {[
            birthDate,
            profile.idnp ? `IDNP ${profile.idnp}` : "IDNP nesetat",
          ]
            .filter(Boolean)
            .join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {profile.notes ? (
          <p className="whitespace-pre-wrap text-sm">{profile.notes}</p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <InsuranceExpiryBanner insurances={insurances} />
        {canWrite ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={() => setEditing(true)}
            >
              Modifică
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant="destructive"
                className="h-11"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setConfirmingDelete(true);
                }}
              >
                {pending ? "Se șterge…" : "Șterge"}
              </Button>
            ) : null}
          </div>
        ) : null}
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
        <ProfileRecords
          documents={documents}
          consultations={consultations}
          labTests={labTests}
        />
      </CardContent>
    </Card>
  );
}

function ProfileRecords({
  documents,
  consultations,
  labTests,
}: {
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
  const pageCount = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const [page, setPage] = useState(0);
  const current = Math.min(page, pageCount - 1);
  if (page !== current) {
    setPage(current);
  }
  const visible = records.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const recordsLabel =
    records.length === 1
      ? "1 înregistrare"
      : `${records.length} înregistrări`;

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium">Înregistrări</h2>
        {records.length > 0 ? (
          <p className="text-xs text-muted-foreground">{recordsLabel}</p>
        ) : null}
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nicio înregistrare pentru această persoană.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((record) => (
            <li key={record.id}>
              <Link
                href={`/records/${record.id}`}
                prefetch
                className="block rounded-lg border px-3 py-3 hover:bg-muted/50"
              >
                <p className="truncate text-sm">
                  <span className="text-muted-foreground">
                    {record.date ? formatBirthDate(record.date) : "Fără dată"}
                  </span>
                  {record.title ? ` · ${record.title}` : ""}
                </p>
                {record.body ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {record.body}
                  </p>
                ) : null}
                {record.fileCount > 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {record.fileCount === 1
                      ? "1 fișier"
                      : `${record.fileCount} fișiere`}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {current + 1} din {pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-8"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              Înapoi
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-8"
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

