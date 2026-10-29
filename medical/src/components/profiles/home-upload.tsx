"use client";

import { useEffect, useRef, useState } from "react";

import {
  detectDocument,
  saveDetectedDocument,
} from "@/app/(app)/profiles/scan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareUploads } from "@/lib/client-image";
import { ACCEPTED_FILE_TYPES } from "@/lib/files";
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

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function HomeUpload({
  people,
  lockedProfileId,
  onSaved,
  onSaveActionChange,
}: {
  people: UploadPerson[];
  lockedProfileId?: string;
  onSaved?: () => void;
  onSaveActionChange?: (action: HomeUploadSaveAction | null) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [pending, setPending] = useState<"detect" | "save" | "prepare" | null>(
    null,
  );
  const [progress, setProgress] = useState<string | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [draft, setDraft] = useState<RecordDraft | null>(null);
  const [profileId, setProfileId] = useState(lockedProfileId ?? "");
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [attachedTo, setAttachedTo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveRef = useRef<() => void>(() => undefined);

  function reset() {
    setFiles([]);
    setFileKey((current) => current + 1);
    setExtraction(null);
    setDraft(null);
    setProfileId(lockedProfileId ?? "");
    setMatchedName(null);
    setAttachedTo(null);
    setProgress(null);
    setError(null);
  }

  async function onDetect() {
    if (files.length === 0) {
      setError("Alege cel puțin un fișier.");
      return;
    }

    setError(null);
    setPending("detect");
    const parts: string[] = [];
    const missed: string[] = [];
    let idnp = "";
    let matchedProfileId: string | null = null;
    let matched: string | null = null;

    for (const [index, file] of files.entries()) {
      setProgress(`Se citește ${index + 1} din ${files.length}…`);
      const data = new FormData();
      data.append("file", file);
      const result = await detectDocument(data);
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
    if (parts.length === 0) {
      setError("Documentele nu au putut fi citite. Încearcă fotografii mai clare sau alt fișier.");
      return;
    }

    const extraction: Extraction = {
      idnp,
      extractedText: parts.join("\n\n").slice(0, MAX_EXTRACTED_TEXT),
      consultation: emptyConsultation(),
      labTests: [],
    };
    setExtraction(extraction);
    setDraft({
      category: DEFAULT_RECORD_CATEGORY,
      title: suggestedTitle(files[0]),
      date: todayInputValue(),
      body: recordBody(extraction),
    });
    setProfileId(lockedProfileId ?? matchedProfileId ?? "");
    setMatchedName(matched);
    if (missed.length > 0) {
      setError(`Nu am putut citi: ${missed.join(", ")}.`);
    }
  }

  async function onSave() {
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

    setError(null);
    setPending("save");
    let primaryId = attachedTo;
    try {
      for (const [index, file] of files.entries()) {
        setProgress(`Se salvează ${index + 1} din ${files.length}…`);
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
          setFiles(files.slice(index));
          setError(
            result.error ??
              `Imaginea ${index + 1} din ${files.length} nu a putut fi salvată.`,
          );
          return;
        }
        primaryId = primaryId ?? result.documentId;
        setAttachedTo(primaryId);
      }
      reset();
      onSaved?.();
    } catch {
      setAttachedTo(primaryId);
      setError("Înregistrarea nu a putut fi salvată. Încearcă din nou.");
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
    onSaveActionChange({
      label: pending === "save" ? progress ?? "Se salvează…" : "Salvează",
      disabled: pending !== null,
      onSave: () => {
        saveRef.current();
      },
    });
  }, [draft, pending, progress, onSaveActionChange]);

  useEffect(() => {
    return () => onSaveActionChange?.(null);
  }, [onSaveActionChange]);

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
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
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
            <select
              id="upload-person"
              className={selectClass}
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
            </select>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="upload-category">Tip</Label>
          <select
            id="upload-category"
            className={selectClass}
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
          </select>
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
              disabled={pending !== null}
              onClick={() => {
                void onSave();
              }}
            >
              {pending === "save" ? progress ?? "Se salvează…" : "Salvează"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11"
              disabled={pending !== null}
              onClick={reset}
            >
              Renunță
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Poți alege mai multe fișiere pentru aceeași înregistrare: imagini, PDF,
        Word (.docx) sau text (.txt). Textul este citit local, iar data și
        textul se salvează o singură dată.
      </p>
      <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3">
        <Label htmlFor={lockedProfileId ? `upload-${lockedProfileId}` : "home-upload"}>
          Imagini, PDF, Word sau text
        </Label>
        <input
          ref={fileRef}
          id={lockedProfileId ? `upload-${lockedProfileId}` : "home-upload"}
          key={fileKey}
          type="file"
          multiple
          accept={ACCEPTED_FILE_TYPES}
          className="sr-only"
          disabled={pending !== null}
          onChange={(event) => {
            const chosen = Array.from(event.target.files ?? []);
            setError(null);
            setFiles([]);
            if (chosen.length === 0) {
              return;
            }
            setPending("prepare");
            void prepareUploads(chosen)
              .then((prepared) => {
                setFiles(prepared.files);
                if (prepared.error) {
                  setError(prepared.error);
                }
              })
              .finally(() => setPending(null));
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
              <li key={`${file.name}-${file.size}-${file.lastModified}`}>{file.name}</li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button
        type="button"
        className="h-11 sm:w-fit"
        disabled={pending !== null || files.length === 0}
        onClick={() => {
          void onDetect();
        }}
      >
        {pending === "prepare"
          ? "Se pregătesc fișierele…"
          : pending === "detect"
            ? (progress ?? "Se citește…")
            : "Citește documentele"}
      </Button>
    </div>
  );
}
