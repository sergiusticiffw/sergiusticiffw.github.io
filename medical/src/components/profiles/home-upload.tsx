"use client";

import { useState } from "react";

import {
  detectDocument,
  saveDetectedDocument,
} from "@/app/(app)/profiles/scan-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  recordBody,
  recordDate,
  type Extraction,
} from "@/lib/validation/extraction";

export type UploadPerson = {
  id: string;
  display_name: string;
  idnp: string | null;
};

type RecordDraft = {
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

const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

export function HomeUpload({
  people,
  lockedProfileId,
}: {
  people: UploadPerson[];
  lockedProfileId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [pending, setPending] = useState<"detect" | "save" | null>(null);
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [draft, setDraft] = useState<RecordDraft | null>(null);
  const [profileId, setProfileId] = useState(lockedProfileId ?? "");
  const [matchedName, setMatchedName] = useState<string | null>(null);

  function reset() {
    setFiles([]);
    setFileKey((current) => current + 1);
    setExtraction(null);
    setDraft(null);
    setProfileId(lockedProfileId ?? "");
    setMatchedName(null);
    setError(null);
  }

  async function onDetect() {
    if (files.length === 0) {
      setError("Alege cel puțin o imagine sau un PDF.");
      return;
    }

    setError(null);
    setPending("detect");
    const data = new FormData();
    for (const file of files) {
      data.append("file", file);
    }
    const result = await detectDocument(data);
    setPending(null);
    if (result.error || !result.extraction) {
      setError(result.error ?? "Documentul nu a putut fi citit.");
      return;
    }

    setExtraction(result.extraction);
    setDraft({
      title: suggestedTitle(files[0]),
      date: recordDate(result.extraction),
      body: recordBody(result.extraction),
    });
    setProfileId(lockedProfileId ?? result.matchedProfileId ?? "");
    setMatchedName(result.matchedName ?? null);
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
      setError("Data nu a fost găsită în document. Completeaz-o înainte să salvezi.");
      return;
    }
    if (!draft.body.trim()) {
      setError("Înregistrarea este goală.");
      return;
    }

    setError(null);
    setPending("save");
    const data = new FormData();
    for (const file of files) {
      data.append("file", file);
    }
    data.set("profileId", profileId);
    data.set("title", draft.title.trim());
    data.set("documentDate", draft.date);
    data.set("body", draft.body);
    data.set("payload", JSON.stringify(extraction));
    if (lockedProfileId) {
      data.set("lockProfile", "1");
    }
    const result = await saveDetectedDocument(data);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    reset();
  }

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
            type="date"
            required
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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="h-11"
            disabled={pending !== null}
            onClick={() => {
              void onSave();
            }}
          >
            {pending === "save" ? "Se salvează…" : "Salvează"}
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
        Poți alege mai multe imagini pentru aceeași înregistrare. Textul este
        citit local, iar data și textul se salvează o singură dată.
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={lockedProfileId ? `upload-${lockedProfileId}` : "home-upload"}>
          Imagini sau PDF
        </Label>
        <Input
          id={lockedProfileId ? `upload-${lockedProfileId}` : "home-upload"}
          key={fileKey}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="h-11"
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
          }}
        />
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
        disabled={pending !== null}
        onClick={() => {
          void onDetect();
        }}
      >
        {pending === "detect" ? "Se citește…" : "Citește documentul"}
      </Button>
    </div>
  );
}
