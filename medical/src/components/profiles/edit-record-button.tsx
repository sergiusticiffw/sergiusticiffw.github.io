"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  addRecordFile,
  deleteRecordFile,
  replaceRecordFile,
  updateRecord,
  type RecordKind,
} from "@/app/(app)/profiles/document-actions";
import type { PreviewFile } from "@/components/profiles/document-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareUploads } from "@/lib/client-image";
import { ACCEPTED_FILE_TYPES, MAX_RECORD_FILES } from "@/lib/files";
import {
  DEFAULT_RECORD_CATEGORY,
  parseRecordCategory,
  RECORD_CATEGORIES,
  type RecordCategory,
} from "@/lib/record-category";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function EditRecordButton({
  kind,
  id,
  title,
  date,
  body,
  category = DEFAULT_RECORD_CATEGORY,
  files = [],
  children,
}: {
  kind: RecordKind;
  id: string;
  title: string;
  date: string;
  body: string;
  category?: string | null;
  files?: PreviewFile[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const replaceRef = useRef<HTMLInputElement>(null);
  const addRef = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<
    "save" | "replace" | "delete" | "add" | null
  >(null);
  const [confirmFileId, setConfirmFileId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDate, setDraftDate] = useState(date);
  const [draftBody, setDraftBody] = useState(body);
  const [draftCategory, setDraftCategory] = useState<RecordCategory>(() =>
    kind === "lab"
      ? parseRecordCategory(category || "Analiză")
      : kind === "consultation"
        ? "Consultație"
        : parseRecordCategory(category),
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function closeForm() {
    if (pending) {
      return;
    }
    setOpen(false);
  }

  function openForm() {
    setDraftTitle(title);
    setDraftDate(date);
    setDraftBody(body);
    setDraftCategory(
      kind === "lab"
        ? parseRecordCategory(category || "Analiză")
        : kind === "consultation"
          ? "Consultație"
          : parseRecordCategory(category),
    );
    setError(null);
    setConfirmFileId(null);
    setReplacingId(null);
    setOpen(true);
  }

  async function onSave() {
    setPending("save");
    setError(null);
    const result = await updateRecord(kind, id, {
      title: draftTitle,
      date: draftDate,
      body: draftBody,
      category: draftCategory,
    });
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function onReplace(fileList: FileList | null) {
    const chosen = fileList?.[0];
    const documentId = replaceId.current;
    replaceId.current = null;
    if (replaceRef.current) {
      replaceRef.current.value = "";
    }
    if (!chosen || !documentId || pending) {
      return;
    }
    setError(null);
    setReplacingId(documentId);
    setPending("replace");
    try {
      const prepared = await prepareUploads([chosen]);
      if (prepared.error || !prepared.files[0]) {
        setError(prepared.error ?? "Fișierul nu a putut fi pregătit.");
        return;
      }
      const data = new FormData();
      data.set("documentId", documentId);
      data.append("file", prepared.files[0]);
      const result = await replaceRecordFile(data);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Fișierul nu a putut fi înlocuit. Încearcă din nou.");
    } finally {
      setPending(null);
      setReplacingId(null);
    }
  }

  async function onAdd(fileList: FileList | null) {
    const chosen = [...(fileList ?? [])].filter((file) => file.size > 0);
    if (chosen.length === 0 || pending) {
      return;
    }
    const remaining = MAX_RECORD_FILES - files.length;
    if (remaining <= 0) {
      setError(`Poți avea cel mult ${MAX_RECORD_FILES} fișiere la o înregistrare.`);
      return;
    }
    if (chosen.length > remaining) {
      setError(
        remaining === 1
          ? "Mai poți adăuga un singur fișier."
          : `Mai poți adăuga ${remaining} fișiere.`,
      );
      return;
    }
    setError(null);
    setPending("add");
    try {
      const prepared = await prepareUploads(chosen);
      if (prepared.error) {
        setError(prepared.error);
        return;
      }
      let currentKind = kind;
      let currentId = id;
      for (const [index, file] of prepared.files.entries()) {
        const data = new FormData();
        data.append("file", file);
        const result = await addRecordFile(currentKind, currentId, data);
        if (result.error) {
          setError(
            prepared.files.length > 1
              ? `Fișierul ${index + 1} din ${prepared.files.length} nu a putut fi adăugat. ${result.error}`
              : result.error,
          );
          return;
        }
        if (result.recordId) {
          currentKind = "document";
          currentId = result.recordId;
        }
      }
      if (currentId !== id) {
        router.push(`/records/${currentId}`);
        return;
      }
      router.refresh();
    } catch {
      setError("Fișierul nu a putut fi adăugat. Încearcă din nou.");
    } finally {
      setPending(null);
    }
  }

  async function onDeleteFile(fileId: string) {
    if (pending) {
      return;
    }
    setError(null);
    setPending("delete");
    try {
      const result = await deleteRecordFile(fileId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmFileId(null);
      if (files.length <= 1) {
        setOpen(false);
      }
      router.refresh();
    } catch {
      setError("Fișierul nu a putut fi șters. Încearcă din nou.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:w-fit"
        disabled={pending !== null}
        onClick={openForm}
      >
        Modifică
      </Button>
      {children}
      <dialog
        ref={dialogRef}
        className="m-0 h-dvh max-h-dvh w-full max-w-none rounded-none border-0 bg-card p-0 text-card-foreground shadow-lg backdrop:bg-black/50 backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 sm:m-auto sm:h-auto sm:max-h-[min(92dvh,44rem)] sm:w-[min(100%-2rem,32rem)] sm:rounded-xl sm:border sm:open:zoom-in-95"
        onCancel={(event) => {
          event.preventDefault();
          closeForm();
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            closeForm();
          }
        }}
      >
        <form
          className="flex h-full max-h-dvh flex-col sm:max-h-[min(92dvh,44rem)]"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h2 className="text-base font-semibold">Modifică înregistrarea</h2>
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={pending !== null}
              onClick={closeForm}
            >
              Închide
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`record-category-${id}`}>Tip</Label>
            <select
              id={`record-category-${id}`}
              className={selectClass}
              value={draftCategory}
              disabled={kind === "consultation"}
              onChange={(event) =>
                setDraftCategory(event.target.value as RecordCategory)
              }
            >
              {RECORD_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {kind === "consultation" ? null : (
            <div className="flex flex-col gap-1">
              <Label htmlFor={`record-title-${id}`}>
                {kind === "lab" ? "Nume" : "Titlu"}
              </Label>
              <Input
                id={`record-title-${id}`}
                value={draftTitle}
                maxLength={160}
                required
                className="h-9"
                onChange={(event) => setDraftTitle(event.target.value)}
              />
            </div>
          )}
          <div className="flex flex-col gap-1">
            <Label htmlFor={`record-date-${id}`}>Data</Label>
            <Input
              id={`record-date-${id}`}
              type="date"
              required
              value={draftDate}
              className="h-9"
              onChange={(event) => setDraftDate(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`record-body-${id}`}>
              {kind === "consultation" ? "Notă" : "Text"}
            </Label>
            <Textarea
              id={`record-body-${id}`}
              value={draftBody}
              className="max-h-48 min-h-24 text-sm"
              onChange={(event) => setDraftBody(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Fișiere</p>
            <input
              ref={replaceRef}
              type="file"
              accept={ACCEPTED_FILE_TYPES}
              className="sr-only"
              aria-label="Înlocuiește fișierul"
              disabled={pending !== null}
              onChange={(event) => {
                void onReplace(event.target.files);
              }}
            />
            <input
              ref={addRef}
              id={`record-add-${id}`}
              type="file"
              multiple
              accept={ACCEPTED_FILE_TYPES}
              className="sr-only"
              aria-label="Adaugă fișiere"
              disabled={pending !== null || files.length >= MAX_RECORD_FILES}
              onChange={(event) => {
                const list = event.target.files;
                event.target.value = "";
                void onAdd(list);
              }}
            />
            {files.length >= MAX_RECORD_FILES ? (
              <p className="text-sm text-muted-foreground">
                Ai atins limita de {MAX_RECORD_FILES} fișiere.
              </p>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3">
                <p className="text-sm">Adaugă un fișier nou</p>
                <p className="text-xs text-muted-foreground">
                  Imagini, PDF, Word (.docx) sau text (.txt).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11"
                  disabled={pending !== null}
                  onClick={() => addRef.current?.click()}
                >
                  {pending === "add" ? "Se adaugă…" : "Alege fișiere"}
                </Button>
              </div>
            )}
            {files.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {files.map((file) => (
                  <li key={file.id} className="rounded-lg border px-3 py-2">
                    <p className="truncate text-sm">{file.filename}</p>
                    {confirmFileId === file.id ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">
                          {files.length > 1
                            ? "Se șterge doar acest fișier din Google Drive. Restul rămân."
                            : "Este ultimul fișier. Se șterge toată înregistrarea."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9"
                            disabled={pending === "delete"}
                            onClick={() => setConfirmFileId(null)}
                          >
                            Renunță
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            className="h-9"
                            disabled={pending === "delete"}
                            onClick={() => {
                              void onDeleteFile(file.id);
                            }}
                          >
                            {pending === "delete"
                              ? "Se șterge…"
                              : files.length > 1
                                ? "Șterge fișierul"
                                : "Șterge înregistrarea"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          disabled={pending !== null}
                          onClick={() => {
                            replaceId.current = file.id;
                            replaceRef.current?.click();
                          }}
                        >
                          {pending === "replace" && replacingId === file.id
                            ? "Se înlocuiește…"
                            : "Înlocuiește"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          className="h-9"
                          disabled={pending !== null}
                          onClick={() => {
                            setError(null);
                            setConfirmFileId(file.id);
                          }}
                        >
                          Șterge
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nu sunt fișiere atașate.
              </p>
            )}
          </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending !== null}
              onClick={closeForm}
            >
              Renunță
            </Button>
            <Button type="submit" className="h-11 sm:w-fit" disabled={pending !== null}>
              {pending === "save" ? "Se salvează…" : "Salvează"}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
