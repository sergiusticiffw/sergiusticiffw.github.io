"use client";

import Link from "next/link";

import { DeleteRecordButton } from "@/components/profiles/delete-record-button";
import { DocumentGallery } from "@/components/profiles/document-preview";
import { EditRecordButton } from "@/components/profiles/edit-record-button";
import { ShareFilesButton } from "@/components/records/share-files-button";
import { SourceBadge } from "@/components/records/source-badge";
import { Avatar } from "@/components/ui/avatar";
import { formatBirthDate } from "@/lib/format";
import { parseRecordCategory } from "@/lib/record-category";
import type { FamilyRecord } from "@/lib/records";

export function RecordDetail({
  record,
  canEdit,
}: {
  record: FamilyRecord;
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/profiles/${record.profileId}`}
        prefetch
        aria-label={`Înregistrare a persoanei ${record.profileName}. Deschide profilul`}
        className="flex min-h-11 w-fit max-w-full items-center gap-2 rounded-full border bg-card py-1 pr-4 pl-1 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Avatar name={record.profileName} size="sm" />
        <span className="truncate">{record.profileName}</span>
      </Link>
      <div className="flex flex-col gap-1.5">
        <p className="text-base text-muted-foreground">
          {parseRecordCategory(
            record.category || (record.kind === "lab" ? "Analiză" : "Consultație"),
          )}
          {` · `}
          {record.date ? formatBirthDate(record.date) : "Fără dată"}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{record.title}</h1>
        <SourceBadge
          source={record.kind === "document" ? "document" : "manual"}
          showHint
        />
      </div>
      {record.files.length > 0 ? (
        <div className="flex flex-col gap-3">
          <DocumentGallery files={record.files} />
          <ShareFilesButton files={record.files} title={record.title} />
        </div>
      ) : null}
      {record.doctorName || record.clinicName || record.specialty ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          {record.doctorName ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Medic</dt>
              <dd className="font-medium">{record.doctorName}</dd>
            </div>
          ) : null}
          {record.clinicName ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">
                {record.kind === "lab" ? "Laborator" : "Clinică"}
              </dt>
              <dd className="font-medium">{record.clinicName}</dd>
            </div>
          ) : null}
          {record.specialty ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-muted-foreground">Specialitate</dt>
              <dd className="font-medium">{record.specialty}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {record.body ? (
        <p className="whitespace-pre-wrap text-base">{record.body}</p>
      ) : (
        <p className="text-base text-muted-foreground">Nu există text salvat.</p>
      )}
      {canEdit ? (
        <div className="sticky bottom-[calc(3.5rem+max(0.5rem,env(safe-area-inset-bottom)))] z-20 -mx-4 mt-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90">
          <div className="grid grid-cols-2 gap-2">
            <EditRecordButton
              kind={record.kind}
              id={record.id}
              title={record.editTitle || record.title}
              date={record.date ?? ""}
              body={record.editBody || record.body}
              category={record.category}
              doctorName={record.doctorName ?? ""}
              clinicName={record.clinicName ?? ""}
              specialty={record.specialty ?? ""}
              files={record.files}
            />
            <DeleteRecordButton
              kind={record.kind}
              id={record.id}
              withFiles={record.files.length > 0}
              afterHref="/records"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
