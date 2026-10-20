"use client";

import Link from "next/link";
import { useState } from "react";

import { deleteProfile } from "@/app/(app)/profiles/actions";
import { ProfileEntries } from "@/components/profiles/profile-entries";
import { ProfileForm } from "@/components/profiles/profile-form";
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

const PAGE_SIZE = 5;

export type MedicalProfile = {
  id: string;
  display_name: string;
  birth_date: string | null;
  idnp: string | null;
  notes: string | null;
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

export function ProfileList({ profiles }: { profiles: MedicalProfile[] }) {
  if (profiles.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nu există profiluri încă. Adaugă prima persoană din familie.
      </p>
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
  driveConnected,
  canWrite = true,
  canEditRecords = canWrite,
  isAdmin = true,
}: {
  profile: MedicalProfile;
  documents: MedicalDocument[];
  consultations: MedicalConsultation[];
  labTests: MedicalLabTest[];
  driveConnected: boolean;
  canWrite?: boolean;
  canEditRecords?: boolean;
  isAdmin?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const birthDate = formatBirthDate(profile.birth_date);

  async function onDelete() {
    setPending(true);
    setError(null);
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
          onClose={() => setEditing(false)}
        >
          <ProfileForm
            profileId={profile.id}
            submitLabel="Salvează"
            defaultValues={{
              displayName: profile.display_name,
              birthDate: profile.birth_date ?? "",
              idnp: profile.idnp ?? "",
              notes: profile.notes ?? "",
            }}
            onDone={() => setEditing(false)}
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
        />
        ) : null}
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
  const primaries = documents.filter((document) => !document.record_id);
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
      .map((item) => ({
        id: item.id,
        date: item.consultation_date,
        title: ["Consultație", item.doctor_name].filter(Boolean).join(" · "),
        body: item.summary?.trim() || "",
        fileCount: 0,
      })),
    ...labTests
      .filter((item) => !item.source_document_id)
      .map((item) => ({
        id: item.id,
        date: item.sample_date,
        title: ["Analiză", item.test_name].filter(Boolean).join(" · "),
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

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <h2 className="text-sm font-medium">Înregistrări</h2>
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

