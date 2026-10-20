"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import {
  createConsultation,
  type RecordActionResult,
} from "@/app/(app)/profiles/record-actions";
import { saveDetectedDocument } from "@/app/(app)/profiles/scan-actions";
import { HomeUpload } from "@/components/profiles/home-upload";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prepareUploads } from "@/lib/client-image";
import { ACCEPTED_FILE_TYPES } from "@/lib/files";

const initialResult: RecordActionResult = {};

function FileField({
  id,
  driveConnected,
}: {
  id: string;
  driveConnected: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);

  if (!driveConnected) {
    return (
      <p className="text-sm text-muted-foreground">
        Conectează Google Drive ca să atașezi imagini, PDF, Word sau text.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed px-3 py-3">
      <p className="text-sm">Adaugă fișiere</p>
      <p className="text-xs text-muted-foreground">
        Opțional. Imagini, PDF, Word (.docx) sau text (.txt).
      </p>
      <input
        ref={inputRef}
        id={id}
        name="file"
        type="file"
        multiple
        accept={ACCEPTED_FILE_TYPES}
        className="sr-only"
        onChange={(event) => {
          setNames(
            [...(event.target.files ?? [])]
              .filter((file) => file.size > 0)
              .map((file) => file.name),
          );
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="h-11"
        onClick={() => inputRef.current?.click()}
      >
        Alege fișiere
      </Button>
      {names.length > 0 ? (
        <ul className="text-xs text-muted-foreground">
          {names.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function todayInputValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function EntryForm({
  action,
  profileId,
  children,
  onSaved,
}: {
  action: (
    previous: RecordActionResult,
    formData: FormData,
  ) => Promise<RecordActionResult>;
  profileId: string;
  children: ReactNode;
  onSaved?: () => void;
}) {
  const [state, setState] = useState<RecordActionResult>(initialResult);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  async function submit(formData: FormData) {
    const chosen = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    formData.delete("file");
    setFileError(null);
    setState(initialResult);

    if (chosen.length === 0) {
      setSaving(true);
      try {
        const result = await action(initialResult, formData);
        setState(result);
        if (result.saved) {
          formRef.current?.reset();
          onSaved?.();
        }
      } catch {
        setState({ error: "Înregistrarea nu a putut fi salvată. Încearcă din nou." });
      } finally {
        setSaving(false);
      }
      return;
    }

    const profileId = String(formData.get("profileId") ?? "");
    const date = String(formData.get("consultationDate") ?? "");
    const summary = String(formData.get("summary") ?? "").trim();
    if (!date) {
      setFileError("Data consultației este obligatorie.");
      return;
    }

    setSaving(true);
    let primaryId: string | null = null;
    try {
      // Shrink photos so each request stays under the hosting body limit.
      const prepared = await prepareUploads(chosen);
      if (prepared.error) {
        setFileError(prepared.error);
        return;
      }
      const files = prepared.files;
      for (const [index, file] of files.entries()) {
        const named =
          files.length > 1
            ? new File([file], `${index + 1}-${file.name}`, { type: file.type })
            : file;
        const data = new FormData();
        data.append("file", named);
        data.set("profileId", profileId);
        data.set("lockProfile", "1");
        data.set("documentDate", date);
        data.set("title", summary.slice(0, 80) || "Consultație");
        data.set("body", primaryId ? "" : summary || "Consultație");
        data.set(
          "payload",
          primaryId
            ? "{}"
            : JSON.stringify({
                idnp: "",
                extractedText: summary,
                consultation: {
                  doctorName: "",
                  clinicName: "",
                  specialty: "",
                  consultationDate: date,
                  summary,
                  recommendations: "",
                },
                labTests: [],
              }),
        );
        if (primaryId) {
          data.set("recordId", primaryId);
        }
        if (index === files.length - 1) {
          data.set("finalize", "1");
        }
        const result = await saveDetectedDocument(data);
        if (result.error || !result.documentId) {
          setFileError(
            result.error ??
              `Imaginea ${index + 1} din ${files.length} nu a putut fi salvată.`,
          );
          return;
        }
        primaryId = primaryId ?? result.documentId;
      }
      formRef.current?.reset();
      router.refresh();
      onSaved?.();
    } catch {
      setFileError("Înregistrarea nu a putut fi salvată. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      ref={formRef}
      action={submit}
      method="post"
      encType="multipart/form-data"
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="profileId" value={profileId} />
      {fileError ?? state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {fileError ?? state.error}
        </p>
      ) : null}
      {children}
      <Button type="submit" className="h-11 sm:w-fit" disabled={saving}>
        {saving ? "Se salvează…" : "Salvează"}
      </Button>
    </form>
  );
}

export function ProfileEntries({
  profileId,
  profileName,
  idnp,
  driveConnected,
}: {
  profileId: string;
  profileName: string;
  idnp: string | null;
  driveConnected: boolean;
}) {
  const [panel, setPanel] = useState<"consultation" | "file" | null>(null);

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <h2 className="text-sm font-medium">Adaugă</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setPanel("consultation")}
        >
          Consultație
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={() => setPanel("file")}
        >
          Document
        </Button>
      </div>
      <FormDialog
        open={panel !== null}
        title={panel === "file" ? "Document nou" : "Consultație nouă"}
        onClose={() => setPanel(null)}
      >
        {panel === "consultation" ? (
          <EntryForm
            action={createConsultation}
            profileId={profileId}
            onSaved={() => setPanel(null)}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`consult-date-${profileId}`}>Data</Label>
              <Input
                id={`consult-date-${profileId}`}
                name="consultationDate"
                type="date"
                required
                defaultValue={todayInputValue()}
                className="h-11"
              />
            </div>
            <Textarea name="summary" className="min-h-24" placeholder="Notă" />
            <FileField
              id={`consult-files-${profileId}`}
              driveConnected={driveConnected}
            />
          </EntryForm>
        ) : null}
        {panel === "file" ? (
          driveConnected ? (
            <HomeUpload
              people={[{ id: profileId, display_name: profileName, idnp }]}
              lockedProfileId={profileId}
              onSaved={() => setPanel(null)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Conectează Google Drive ca să încarci un document privat.
            </p>
          )
        ) : null}
      </FormDialog>
    </div>
  );
}
