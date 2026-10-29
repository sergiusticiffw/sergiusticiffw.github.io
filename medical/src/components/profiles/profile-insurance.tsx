"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import {
  createInsurance,
  deleteInsurance,
  updateInsurance,
} from "@/app/(app)/profiles/insurance-actions";
import { DocumentGallery } from "@/components/profiles/document-preview";
import {
  type ProfileIdentityDoc,
} from "@/components/profiles/profile-identity-docs";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareUploads } from "@/lib/client-image";
import { ACCEPTED_FILE_TYPES } from "@/lib/files";
import { formatBirthDate } from "@/lib/format";

export type ProfileInsurance = {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  source_document_id: string | null;
  filename: string | null;
  mime_type: string | null;
};

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function statusFor(start: string, end: string, today: string) {
  if (today < start) return "viitoare" as const;
  if (today > end) return "expirată" as const;
  return "activă" as const;
}

function sortInsurances(items: ProfileInsurance[]) {
  return [...items].sort((left, right) => {
    if (left.end_date === right.end_date) {
      return right.start_date.localeCompare(left.start_date);
    }
    return right.end_date.localeCompare(left.end_date);
  });
}

function galleryFiles(
  insurance: ProfileInsurance,
  identityDocs: ProfileIdentityDoc[] = [],
) {
  const files: {
    id: string;
    filename: string;
    mimeType: string | null;
  }[] = [];
  if (insurance.source_document_id) {
    files.push({
      id: insurance.source_document_id,
      filename: insurance.filename || "Poliță",
      mimeType: insurance.mime_type,
    });
  }
  for (const doc of identityDocs) {
    if (!doc.source_document_id) continue;
    if (files.some((file) => file.id === doc.source_document_id)) continue;
    files.push({
      id: doc.source_document_id,
      filename: doc.filename || doc.title || "Act",
      mimeType: doc.mime_type,
    });
  }
  return files;
}

function InsuranceCard({
  item,
  status,
  featured,
  canEdit,
  onEdit,
  onDelete,
  identityDocs = [],
}: {
  item: ProfileInsurance;
  status: "activă" | "expirată" | "viitoare";
  featured: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
  identityDocs?: ProfileIdentityDoc[];
}) {
  if (!featured) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-2 opacity-80">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatBirthDate(item.start_date)} – {formatBirthDate(item.end_date)}
              {` · ${status}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.source_document_id ? (
              <a
                href={`/api/documents/${item.source_document_id}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs underline-offset-2 hover:underline"
              >
                Deschide
              </a>
            ) : null}
            {canEdit ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs"
                  onClick={onEdit}
                >
                  Modifică
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-2 text-xs text-destructive"
                  onClick={onDelete}
                >
                  Șterge
                </Button>
              </>
            ) : null}
          </div>
        </div>
      </li>
    );
  }

  const files = galleryFiles(item, identityDocs);

  return (
    <div className="rounded-lg border-2 border-foreground/15 bg-muted/30 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">{item.title}</p>
        <span
          className={
            status === "activă"
              ? "rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
              : status === "viitoare"
                ? "rounded-md bg-sky-500/15 px-2 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300"
                : "rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {status}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatBirthDate(item.start_date)} – {formatBirthDate(item.end_date)}
      </p>
      {item.notes ? (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {item.notes}
        </p>
      ) : null}
      {files.length > 0 ? (
        <div className="mt-2">
          <DocumentGallery files={files} />
        </div>
      ) : null}
      {canEdit ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="h-9" onClick={onEdit}>
            Modifică
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-9"
            onClick={onDelete}
          >
            Șterge
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function InsuranceForm({
  profileId,
  formId,
  insurance,
  driveConnected,
  onSaved,
  onPendingChange,
}: {
  profileId: string;
  formId: string;
  insurance?: ProfileInsurance | null;
  driveConnected: boolean;
  onSaved: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPendingState] = useState(false);
  function setPending(next: boolean) {
    setPendingState(next);
    onPendingChange?.(next);
  }
  const [fileName, setFileName] = useState<string | null>(null);
  const [title, setTitle] = useState(insurance?.title ?? "");
  const [startDate, setStartDate] = useState(
    insurance?.start_date ?? todayInputValue(),
  );
  const [endDate, setEndDate] = useState(insurance?.end_date ?? "");
  const [notes, setNotes] = useState(insurance?.notes ?? "");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!driveConnected) {
      setError("Conectează Google Drive ca să salvezi polița.");
      return;
    }
    const chosen = fileRef.current?.files?.[0];
    if (!insurance && (!chosen || chosen.size === 0)) {
      setError("Atașează polița de asigurare.");
      return;
    }

    setPending(true);
    try {
      const data = new FormData();
      data.set("profileId", profileId);
      if (insurance) {
        data.set("insuranceId", insurance.id);
      }
      data.set("title", title.trim());
      data.set("startDate", startDate);
      data.set("endDate", endDate);
      data.set("notes", notes.trim());
      if (chosen && chosen.size > 0) {
        const prepared = await prepareUploads([chosen]);
        if (prepared.error || !prepared.files[0]) {
          setError(prepared.error ?? "Fișierul nu a putut fi pregătit.");
          return;
        }
        data.set("file", prepared.files[0]);
      }
      const result = insurance
        ? await updateInsurance(data)
        : await createInsurance(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      onSaved();
      router.refresh();
    } catch {
      setError("Asigurarea nu a putut fi salvată. Încearcă din nou.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      id={formId}
      className="flex flex-col gap-3"
      onSubmit={(event) => void onSubmit(event)}
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <Label htmlFor="insurance-title">Titlu</Label>
        <Input
          id="insurance-title"
          required
          maxLength={160}
          className="h-11"
          value={title}
          placeholder="ex. Asigurare facultativă 2026"
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor="insurance-start">Data start</Label>
          <Input
            id="insurance-start"
            type="date"
            required
            className="h-11"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="insurance-end">Data expirare</Label>
          <Input
            id="insurance-end"
            type="date"
            required
            className="h-11"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="insurance-notes">Notă (opțional)</Label>
        <Textarea
          id="insurance-notes"
          className="min-h-20"
          value={notes}
          maxLength={2000}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3">
        <p className="text-sm">
          {insurance ? "Înlocuiește fișierul (opțional)" : "Polița (obligatoriu)"}
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, imagine, Word sau text.
          {insurance?.filename ? ` Actual: ${insurance.filename}` : ""}
        </p>
        <input
          ref={fileRef}
          id="insurance-file"
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setFileName(file?.name ?? null);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending || !driveConnected}
          onClick={() => fileRef.current?.click()}
        >
          Alege fișier
        </Button>
        {fileName ? (
          <p className="text-xs text-muted-foreground">{fileName}</p>
        ) : null}
        {!driveConnected ? (
          <p className="text-xs text-muted-foreground">
            Conectează Google Drive ca să atașezi polița.
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function ProfileInsuranceSection({
  identityDocs,
  profileId,
  insurances,
  driveConnected,
  canEdit,
}: {
  profileId: string;
  insurances: ProfileInsurance[];
  driveConnected: boolean;
  canEdit: boolean;
  identityDocs: ProfileIdentityDoc[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProfileInsurance | null>(null);
  const [deleting, setDeleting] = useState<ProfileInsurance | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [formPending, setFormPending] = useState(false);
  const addFormId = `insurance-add-${profileId}`;
  const editFormId = `insurance-edit-${profileId}`;
  const today = todayInputValue();
  const sorted = sortInsurances(insurances);
  const current =
    sorted.find(
      (item) => statusFor(item.start_date, item.end_date, today) === "activă",
    ) ??
    sorted.find(
      (item) => statusFor(item.start_date, item.end_date, today) === "viitoare",
    ) ??
    sorted[0] ??
    null;
  const history = sorted.filter((item) => item.id !== current?.id);

  async function onDelete() {
    if (!deleting) return;
    setPendingDelete(true);
    setDeleteError(null);
    const result = await deleteInsurance(deleting.id);
    setPendingDelete(false);
    if (result.error) {
      setDeleteError(result.error);
      return;
    }
    setDeleting(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 border-t pt-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Asigurări medicale</h2>
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            className="h-9"
            onClick={() => setAdding(true)}
          >
            Adaugă
          </Button>
        ) : null}
      </div>
      {insurances.length === 0 && identityDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nicio asigurare adăugată încă.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {current ? (
            <InsuranceCard
              item={current}
              status={statusFor(current.start_date, current.end_date, today)}
              featured
              canEdit={canEdit}
              identityDocs={identityDocs}
              onEdit={() => setEditing(current)}
              onDelete={() => {
                setDeleteError(null);
                setDeleting(current);
              }}
            />
          ) : identityDocs.some((doc) => doc.source_document_id) ? (
            <div className="rounded-lg border-2 border-foreground/15 bg-muted/30 px-3 py-3">
              <p className="mb-2 text-xs text-muted-foreground">Act</p>
              <DocumentGallery
                files={identityDocs.flatMap((doc) =>
                  doc.source_document_id
                    ? [
                        {
                          id: doc.source_document_id,
                          filename: doc.filename || doc.title || "Act",
                          mimeType: doc.mime_type,
                        },
                      ]
                    : [],
                )}
              />
            </div>
          ) : null}
          {history.length > 0 ? (
            <details className="group">
              <summary className="cursor-pointer list-none text-xs text-muted-foreground underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden">
                Istoric ({history.length}{" "}
                {history.length === 1 ? "poliță anterioară" : "polițe anterioare"})
              </summary>
              <ul className="mt-2 flex flex-col gap-2">
                {history.map((item) => (
                  <InsuranceCard
                    key={item.id}
                    item={item}
                    status={statusFor(item.start_date, item.end_date, today)}
                    featured={false}
                    canEdit={canEdit}
                    onEdit={() => setEditing(item)}
                    onDelete={() => {
                      setDeleteError(null);
                      setDeleting(item);
                    }}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      <FormDialog
        open={adding}
        title="Asigurare nouă"
        pending={formPending}
        onClose={() => {
          if (!formPending) setAdding(false);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={formPending}
              onClick={() => setAdding(false)}
            >
              Renunță
            </Button>
            <Button
              type="submit"
              form={addFormId}
              className="h-11 sm:w-fit"
              disabled={formPending}
            >
              {formPending ? "Se salvează…" : "Salvează"}
            </Button>
          </>
        }
      >
        <InsuranceForm
          profileId={profileId}
          formId={addFormId}
          driveConnected={driveConnected}
          onSaved={() => setAdding(false)}
          onPendingChange={setFormPending}
        />
      </FormDialog>

      <FormDialog
        open={editing !== null}
        title="Modifică asigurarea"
        pending={formPending}
        onClose={() => {
          if (!formPending) setEditing(null);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={formPending}
              onClick={() => setEditing(null)}
            >
              Renunță
            </Button>
            <Button
              type="submit"
              form={editFormId}
              className="h-11 sm:w-fit"
              disabled={formPending}
            >
              {formPending ? "Se salvează…" : "Salvează"}
            </Button>
          </>
        }
      >
        {editing ? (
          <InsuranceForm
            key={editing.id}
            profileId={profileId}
            formId={editFormId}
            insurance={editing}
            driveConnected={driveConnected}
            onSaved={() => setEditing(null)}
            onPendingChange={setFormPending}
          />
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={deleting !== null}
        title={
          deleting
            ? `Ștergi asigurarea „${deleting.title}”?`
            : "Ștergi asigurarea?"
        }
        description="Se șterge și fișierul poliței din Google Drive. Acțiunea nu poate fi anulată."
        confirmLabel="Șterge"
        pending={pendingDelete}
        error={deleteError}
        onConfirm={() => {
          void onDelete();
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
