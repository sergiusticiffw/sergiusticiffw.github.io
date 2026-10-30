"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  detectDocument,
  saveDetectedDocument,
} from "@/app/(app)/profiles/scan-actions";
import { DriveConnectCta } from "@/components/layout/drive-connect-cta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prepareUploads } from "@/lib/client-image";
import {
  ACCEPTED_FILE_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_RECORD_BYTES,
  MAX_RECORD_FILES,
} from "@/lib/files";
import {
  DEFAULT_RECORD_CATEGORY,
  RECORD_CATEGORIES,
  type RecordCategory,
} from "@/lib/record-category";
import {
  emptyConsultation,
  MAX_EXTRACTED_TEXT,
  recordBody,
  type Extraction,
} from "@/lib/validation/extraction";

export type UploadPerson = {
  id: string;
  display_name: string;
  idnp: string | null;
};

export type HomeUploadSaveAction = {
  label: string;
  disabled: boolean;
  onSave: () => void;
};

type RecordDraft = {
  category: RecordCategory;
  title: string;
  date: string;
  body: string;
};

type ProgressState = {
  phase: "prepare" | "detect" | "save";
  current: number;
  total: number;
  fileName: string;
};

function suggestedTitle(file: File | undefined) {
  if (!file) {
    return "";
  }
  return file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").slice(0, 160);
}

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatMb(bytes: number) {
  return (bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1);
}

export function HomeUpload({
  people,
  lockedProfileId,
  driveConnected = true,
  canConnectDrive = false,
  onSaved,
  onSaveActionChange,
}: {
  people: UploadPerson[];
  lockedProfileId?: string;
  driveConnected?: boolean;
  canConnectDrive?: boolean;
  onSaved?: () => void;
  onSaveActionChange?: (action: HomeUploadSaveAction | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [pending, setPending] = useState<"detect" | "save" | "prepare" | null>(
    null,
  );
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [draft, setDraft] = useState<RecordDraft | null>(null);
  const [profileId, setProfileId] = useState(lockedProfileId ?? "");
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [attachedTo, setAttachedTo] = useState<string | null>(null);
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [originalTotal, setOriginalTotal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<() => void>(() => undefined);
  const cancelRef = useRef(false);

  function reset() {
    cancelRef.current = true;
    setFiles([]);
    setFileKey((current) => current + 1);
    setExtraction(null);
    setDraft(null);
    setProfileId(lockedProfileId ?? "");
    setMatchedName(null);
    setAttachedTo(null);
    setSavedNames([]);
    setOriginalTotal(0);
    setProgress(null);
    setPending(null);
    setError(null);
  }

  function cancelWork() {
    cancelRef.current = true;
    setPending(null);
    setProgress(null);
    setError("Operațiunea a fost anulată.");
  }

  async function takeFiles(chosen: File[]) {
    setError(null);
    setFiles([]);
    setSavedNames([]);
    setAttachedTo(null);
    setOriginalTotal(0);
    if (chosen.length === 0) {
      return;
    }
    if (chosen.length > MAX_RECORD_FILES) {
      setError(`Poți alege cel mult ${MAX_RECORD_FILES} fișiere pe înregistrare.`);
      return;
    }
    cancelRef.current = false;
    setPending("prepare");
    setProgress({
      phase: "prepare",
      current: 0,
      total: chosen.length,
      fileName: chosen[0]?.name ?? "",
    });
    try {
      const prepared = await prepareUploads(chosen);
      if (cancelRef.current) {
        return;
      }
      setFiles(prepared.files);
      setOriginalTotal(prepared.files.length);
      if (prepared.error) {
        setError(prepared.error);
      }
    } finally {
      if (!cancelRef.current) {
        setPending(null);
        setProgress(null);
      }
    }
  }

  async function onDetect() {
    if (!driveConnected) {
      setError("Conectează Google Drive înainte să citești documentele.");
      return;
    }
    if (files.length === 0) {
      setError("Alege cel puțin un fișier.");
      return;
    }

    cancelRef.current = false;
    setError(null);
    setPending("detect");
    const parts: string[] = [];
    const missed: string[] = [];
    let idnp = "";
    let matchedProfileId: string | null = null;
    let matched: string | null = null;

    for (const [index, file] of files.entries()) {
      if (cancelRef.current) {
        setPending(null);
        setProgress(null);
        return;
      }
      setProgress({
        phase: "detect",
        current: index + 1,
        total: files.length,
        fileName: file.name,
      });
      const data = new FormData();
      data.append("file", file);
      const result = await detectDocument(data);
      if (cancelRef.current) {
        setPending(null);
        setProgress(null);
        return;
      }
      const text = result.extraction?.extractedText.trim() ?? "";
      if (result.error || !text) {
        missed.push(file.name);
        continue;
      }
      parts.push(files.length > 1 ? `${file.name}\n${text}` : text);
      if (!idnp && result.extraction?.idnp) {
        idnp = result.extraction.idnp;
      }
      if (!matchedProfileId && result.matchedProfileId) {
        matchedProfileId = result.matchedProfileId;
        matched = result.matchedName ?? null;
      }
    }

    setPending(null);
    setProgress(null);
    if (cancelRef.current) {
      return;
    }
    if (parts.length === 0) {
      setError(
        "Documentele nu au putut fi citite. Încearcă fotografii mai clare sau alt fișier.",
      );
      return;
    }

    const nextExtraction: Extraction = {
      idnp,
      extractedText: parts.join("\n\n").slice(0, MAX_EXTRACTED_TEXT),
      consultation: emptyConsultation(),
      labTests: [],
    };
    setExtraction(nextExtraction);
    setDraft({
      category: DEFAULT_RECORD_CATEGORY,
      title: suggestedTitle(files[0]),
      date: todayInputValue(),
      body: recordBody(nextExtraction),
    });
    setProfileId(lockedProfileId ?? matchedProfileId ?? "");
    setMatchedName(matched);
    if (missed.length > 0) {
      setError(`Nu am putut citi: ${missed.join(", ")}.`);
    }
  }

  async function onSave() {
    if (!driveConnected) {
      setError("Conectează Google Drive înainte să salvezi.");
      return;
    }
    if (files.length === 0 || !draft || !extraction) {
      return;
    }
    if (!profileId) {
      setError("Alege persoana căreia îi aparține documentul.");
      return;
    }
    if (!draft.title.trim()) {
      setError("Titlul este obligatoriu.");
      return;
    }
    if (!draft.date) {
      setError("Completează data înainte să salvezi.");
      return;
    }
    if (!draft.body.trim()) {
      setError("Înregistrarea este goală.");
      return;
    }

    cancelRef.current = false;
    setError(null);
    setPending("save");
    let primaryId = attachedTo;
    const newlySaved: string[] = [];
    try {
      for (const [index, file] of files.entries()) {
        if (cancelRef.current) {
          setAttachedTo(primaryId);
          setSavedNames((current) => [...current, ...newlySaved]);
          setFiles(files.slice(index));
          return;
        }
        setProgress({
          phase: "save",
          current: savedNames.length + newlySaved.length + 1,
          total: Math.max(originalTotal, savedNames.length + files.length),
          fileName: file.name,
        });
        const named =
          files.length > 1
            ? new File([file], `${index + 1}-${file.name}`, { type: file.type })
            : file;
        const data = new FormData();
        data.append("file", named);
        data.set("profileId", profileId);
        data.set("category", draft.category);
        data.set("title", draft.title.trim());
        data.set("documentDate", draft.date);
        data.set("body", primaryId ? "" : draft.body);
        data.set("payload", primaryId ? "{}" : JSON.stringify(extraction));
        if (lockedProfileId) {
          data.set("lockProfile", "1");
        }
        if (primaryId) {
          data.set("recordId", primaryId);
        }
        if (index === files.length - 1) {
          data.set("finalize", "1");
        }
        const result = await saveDetectedDocument(data);
        if (result.error || !result.documentId) {
          setAttachedTo(primaryId);
          setSavedNames((current) => [...current, ...newlySaved]);
          setFiles(files.slice(index));
          setError(
            result.error ??
              `„${file.name}” nu a putut fi salvat. Apasă Salvează din nou pentru fișierele rămase.`,
          );
          return;
        }
        primaryId = primaryId ?? result.documentId;
        setAttachedTo(primaryId);
        newlySaved.push(file.name);
      }
      reset();
      onSaved?.();
    } catch {
      setAttachedTo(primaryId);
      setSavedNames((current) => [...current, ...newlySaved]);
      setError(
        "Înregistrarea nu a putut fi salvată. Apasă Salvează din nou pentru fișierele rămase.",
      );
    } finally {
      setPending(null);
      setProgress(null);
    }
  }

  saveRef.current = () => {
    void onSave();
  };

  useEffect(() => {
    if (!onSaveActionChange) {
      return;
    }
    if (!draft) {
      onSaveActionChange(null);
      return;
    }
    const label =
      pending === "save" && progress
        ? `Se salvează ${progress.current}/${progress.total}…`
        : savedNames.length > 0
          ? "Salvează restul"
          : "Salvează";
    onSaveActionChange({
      label,
      disabled: pending !== null || !driveConnected,
      onSave: () => {
        saveRef.current();
      },
    });
  }, [
    draft,
    pending,
    progress,
    savedNames.length,
    driveConnected,
    onSaveActionChange,
  ]);

  useEffect(() => {
    return () => onSaveActionChange?.(null);
  }, [onSaveActionChange]);

  const progressLabel = progress
    ? progress.phase === "prepare"
      ? "Se pregătesc fișierele…"
      : progress.phase === "detect"
        ? `Se citește ${progress.current} din ${progress.total}: ${progress.fileName}`
        : `Se salvează ${progress.current} din ${progress.total}: ${progress.fileName}`
    : null;

  if (draft) {
    const lockedPerson = people.find((person) => person.id === lockedProfileId);
    const otherPerson =
      lockedProfileId &&
      matchedName &&
      lockedPerson &&
      matchedName !== lockedPerson.display_name
        ? matchedName
        : null;

    return (
      <div className="flex flex-col gap-4">
        {!driveConnected ? (
          <DriveConnectCta canConnect={canConnectDrive} />
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {progressLabel ? (
          <div className="flex flex-col gap-2" aria-live="polite">
            <p className="text-sm text-muted-foreground">{progressLabel}</p>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:w-fit"
              onClick={cancelWork}
            >
              Anulează
            </Button>
          </div>
        ) : null}
        {savedNames.length > 0 ? (
          <div className="rounded-lg border px-3 py-3 text-sm">
            <p className="font-medium">
              Salvate {savedNames.length}
              {originalTotal > 0 ? ` din ${originalTotal}` : ""}
            </p>
            <ul className="mt-1 list-inside list-disc text-muted-foreground">
              {savedNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            {files.length > 0 ? (
              <>
                <p className="mt-2 font-medium">Rămase</p>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {files.map((file) => (
                    <li key={`${file.name}-${file.size}`}>{file.name}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
        <p className="text-sm">
          {lockedProfileId
            ? "Documentul a fost citit. Verifică titlul, data și textul, apoi salvează o singură înregistrare."
            : matchedName
              ? `Documentul a fost recunoscut pentru ${matchedName}.`
              : "IDNP-ul nu corespunde unei persoane. Alege persoana înainte să salvezi."}
        </p>
        <p className="text-sm text-muted-foreground">
          {files.length === 1
            ? "1 fișier va fi salvat în înregistrare."
            : `${files.length} fișiere vor fi salvate în aceeași înregistrare.`}
        </p>
        {otherPerson ? (
          <p className="text-sm text-muted-foreground">
            IDNP-ul din document corespunde lui {otherPerson}. Înregistrarea
            rămâne la persoana deschisă.
          </p>
        ) : null}
        {lockedProfileId ? null : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="upload-person">Persoană</Label>
            <Select
              id="upload-person"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value)}
            >
              <option value="">Alege persoana</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.display_name}
                  {person.idnp ? ` · ${person.idnp}` : ""}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="upload-category">Tip</Label>
          <Select
            id="upload-category"
            value={draft.category}
            onChange={(event) =>
              setDraft({
                ...draft,
                category: event.target.value as RecordCategory,
              })
            }
          >
            {RECORD_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="upload-title">Titlu</Label>
          <Input
            id="upload-title"
            required
            maxLength={160}
            className="h-11"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="upload-date">Data din document</Label>
          <Input
            id="upload-date"
            name="document-date"
            type="date"
            required
            autoComplete="off"
            className="h-11"
            value={draft.date}
            onChange={(event) => setDraft({ ...draft, date: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="upload-body">Înregistrare</Label>
          <Textarea
            id="upload-body"
            className="min-h-64"
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
          />
        </div>
        {onSaveActionChange ? null : (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              className="h-11"
              disabled={pending !== null || !driveConnected}
              onClick={() => {
                void onSave();
              }}
            >
              {pending === "save"
                ? progressLabel ?? "Se salvează…"
                : savedNames.length > 0
                  ? "Salvează restul"
                  : "Salvează"}
            </Button>
            {pending === "save" ? (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={cancelWork}
              >
                Anulează
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={pending !== null}
                onClick={reset}
              >
                Renunță
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {!driveConnected ? (
        <DriveConnectCta canConnect={canConnectDrive} />
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Poți alege mai multe fișiere pentru aceeași înregistrare: imagini, PDF,
        Word (.docx) sau text (.txt). Fotografiile se comprimă automat. Maxim{" "}
        {MAX_RECORD_FILES} fișiere, ~{formatMb(MAX_DOCUMENT_BYTES)} MB pe
        fișier la încărcare și ~{formatMb(MAX_RECORD_BYTES)} MB pe înregistrare.
      </p>
      <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3">
        <Label htmlFor={lockedProfileId ? `upload-${lockedProfileId}` : "home-upload"}>
          Imagini, PDF, Word sau text
        </Label>
        <input
          ref={fileRef}
          id={lockedProfileId ? `upload-${lockedProfileId}` : "home-upload"}
          key={`files-${fileKey}`}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          disabled={pending !== null}
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? []);
            void takeFiles(chosen);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending !== null}
          onClick={() => fileRef.current?.click()}
        >
          Alege fișiere
        </Button>
        {files.length > 0 ? (
          <ul className="text-sm text-muted-foreground">
            {files.map((file) => (
              <li key={`${file.name}-${file.size}-${file.lastModified}`}>
                {file.name}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {progressLabel ? (
        <div className="flex flex-col gap-2" aria-live="polite">
          <p className="text-sm text-muted-foreground">{progressLabel}</p>
          <Button
            type="button"
            variant="outline"
            className="h-11 sm:w-fit"
            onClick={cancelWork}
          >
            Anulează
          </Button>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          className="h-11 sm:w-fit"
          disabled={
            pending !== null || files.length === 0 || !driveConnected
          }
          onClick={() => {
            void onDetect();
          }}
        >
          {pending === "prepare"
            ? "Se pregătesc fișierele…"
            : pending === "detect"
              ? (progressLabel ?? "Se citește…")
              : "Citește documentele"}
        </Button>
        {!driveConnected && canConnectDrive ? (
          <Link
            href="/api/google/connect"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Conectează Google Drive
          </Link>
        ) : null}
      </div>
    </div>
  );
}
