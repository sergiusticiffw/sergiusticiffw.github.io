"use client";

import Link from "next/link";

import { DeleteRecordButton } from "@/components/profiles/delete-record-button";
import { DocumentGallery } from "@/components/profiles/document-preview";
import { EditRecordButton } from "@/components/profiles/edit-record-button";
import type { FamilyRecord } from "@/lib/records";
import { formatBirthDate } from "@/lib/format";

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
        className="text-sm text-muted-foreground hover:underline"
      >
        Înapoi la profil
      </Link>
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          {record.date ? formatBirthDate(record.date) : "Fără dată"}
          {` · `}
          <Link
            href={`/profiles/${record.profileId}`}
            prefetch
            className="underline-offset-2 hover:underline"
          >
            {record.profileName}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{record.title}</h1>
      </div>
      {record.files.length > 0 ? (
        <DocumentGallery files={record.files} />
      ) : null}
      {record.body ? (
        <p className="whitespace-pre-wrap text-sm">{record.body}</p>
      ) : (
        <p className="text-sm text-muted-foreground">Nu există text salvat.</p>
      )}
      {canEdit ? (
        <div className="border-t pt-4">
          <EditRecordButton
            kind={record.kind}
            id={record.id}
            title={record.editTitle || record.title}
            date={record.date ?? ""}
            body={record.editBody || record.body}
            files={record.files}
          >
            <DeleteRecordButton
              kind={record.kind}
              id={record.id}
              withFiles={record.files.length > 0}
              afterHref="/records"
            />
          </EditRecordButton>
        </div>
      ) : null}
    </div>
  );
}
