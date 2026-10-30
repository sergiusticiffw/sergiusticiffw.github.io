"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import {
  createIdentityDoc,
  deleteIdentityDoc,
  updateIdentityDoc,
} from "@/app/(app)/profiles/identity-actions";
import { DriveConnectCta } from "@/components/layout/drive-connect-cta";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareUploads } from "@/lib/client-image";
import { ACCEPTED_FILE_TYPES } from "@/lib/files";
import { requireSensitiveUnlock } from "@/lib/sensitive-action";

export type ProfileIdentityDoc = {
  id: string;
  title: string;
  issued_date: string | null;
  notes: string | null;
  source_document_id: string | null;
  filename: string | null;
  mime_type: string | null;
};

const TITLE_SUGGESTIONS = [
  "Buletin de identitate",
  "Certificat de naștere",
  "Pașaport",
  "Permis de conducere",
];

export type IdentityDraft = {
  title: string;
  issuedDate: string;
  notes: string;
  file: File | null;
};

export function emptyIdentityDraft(
  doc?: ProfileIdentityDoc | null,
): IdentityDraft {
  return {
    title: doc?.title ?? "",
    issuedDate: doc?.issued_date ?? "",
    notes: doc?.notes ?? "",
    file: null,
  };
}

/** Fields only — saved with the parent profile form. */
export function ProfileIdentityFields({
  idPrefix,
  doc,
  draft,
  onChange,
  driveConnected,
  onDeleted,
}: {
  idPrefix: string;
  doc?: ProfileIdentityDoc | null;
  draft: IdentityDraft;
  onChange: (next: IdentityDraft) => void;
  driveConnected: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function onConfirmDelete() {
    if (!doc) {
      onChange(emptyIdentityDraft(null));
      setDeleting(false);
      return;
    }
    setPendingDelete(true);
    setDeleteError(null);
    const unlock = await requireSensitiveUnlock();
    if (unlock.error) {
      setDeleteError(unlock.error);
      setPendingDelete(false);
      return;
    }
    const result = await deleteIdentityDoc(doc.id);
    setPendingDelete(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    onChange(emptyIdentityDraft(null));
    onDeleted?.();
    setDeleting(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Act de identitate</h3>
          <p className="text-xs text-muted-foreground">
            Buletin, certificat de naștere sau alt document pe persoană.
          </p>
        </div>
        {doc ? (
          <Button
            type="button"
            variant="ghost"
            className="h-8 shrink-0 px-2 text-xs text-destructive"
            onClick={() => {
              setDeleteError(null);
              setDeleting(true);
            }}
          >
            Șterge
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-identity-title`}>Titlu</Label>
        <Input
          id={`${idPrefix}-identity-title`}
          maxLength={160}
          className="h-11"
          value={draft.title}
          list={`${idPrefix}-identity-title-suggestions`}
          placeholder="ex. Buletin de identitate"
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value })
          }
        />
        <datalist id={`${idPrefix}-identity-title-suggestions`}>
          {TITLE_SUGGESTIONS.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-identity-issued`}>Data (opțional)</Label>
        <Input
          id={`${idPrefix}-identity-issued`}
          type="date"
          className="h-11"
          value={draft.issuedDate}
          onChange={(event) =>
            onChange({ ...draft, issuedDate: event.target.value })
          }
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${idPrefix}-identity-notes`}>Notă (opțional)</Label>
        <Textarea
          id={`${idPrefix}-identity-notes`}
          className="min-h-20"
          value={draft.notes}
          maxLength={2000}
          onChange={(event) =>
            onChange({ ...draft, notes: event.target.value })
          }
        />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3">
        <p className="text-sm">
          {doc ? "Înlocuiește fișierul (opțional)" : "Fișier"}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, imagine, Word sau text.
          {doc?.filename ? ` Actual: ${doc.filename}` : ""}
        </p>
        <input
          ref={fileRef}
          id={`${idPrefix}-identity-file`}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            onChange({ ...draft, file });
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={!driveConnected}
          onClick={() => fileRef.current?.click()}
        >
          Alege fișier
        </Button>
        {draft.file ? (
          <p className="text-xs text-muted-foreground">{draft.file.name}</p>
        ) : null}
        {!driveConnected ? <DriveConnectCta /> : null}
      </div>

      <ConfirmDialog
        open={deleting}
        title={doc ? `Ștergi actul „${doc.title}”?` : "Ștergi actul?"}
        description="Se șterge și fișierul din Google Drive. Acțiunea nu poate fi anulată."
        confirmLabel="Șterge"
        pending={pendingDelete}
        error={deleteError}
        onConfirm={() => {
          void onConfirmDelete();
        }}
        onCancel={() => setDeleting(false)}
      />
    </div>
  );
}

export async function saveIdentityDraft(options: {
  profileId: string;
  existing: ProfileIdentityDoc | null | undefined;
  draft: IdentityDraft;
  driveConnected: boolean;
}): Promise<{ error?: string }> {
  const { profileId, existing, draft, driveConnected } = options;
  if (!existing && !draft.title.trim() && !draft.file) {
    return {};
  }

  const title = draft.title.trim();
  if (!title) {
    return { error: "Titlul actului este obligatoriu." };
  }
  if (!existing && !draft.file) {
    return { error: "Atașează fișierul actului de identitate." };
  }
  if ((draft.file || !existing) && !driveConnected) {
    return { error: "Conectează Google Drive ca să salvezi actul." };
  }

  const data = new FormData();
  data.set("profileId", profileId);
  if (existing) {
    data.set("identityId", existing.id);
  }
  data.set("title", title);
  data.set("issuedDate", draft.issuedDate);
  data.set("notes", draft.notes.trim());
  if (draft.file) {
    const prepared = await prepareUploads([draft.file]);
    if (prepared.error || !prepared.files[0]) {
      return { error: prepared.error ?? "Fișierul nu a putut fi pregătit." };
    }
    data.set("file", prepared.files[0]);
  }

  const result = existing
    ? await updateIdentityDoc(data)
    : await createIdentityDoc(data);
  if (result.error) {
    return { error: result.error };
  }
  return {};
}
