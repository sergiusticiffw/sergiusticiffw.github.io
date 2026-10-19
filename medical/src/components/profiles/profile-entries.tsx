"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import {
  createConsultation,
  type RecordActionResult,
} from "@/app/(app)/profiles/record-actions";
import { saveDetectedDocument } from "@/app/(app)/profiles/scan-actions";
import { HomeUpload } from "@/components/profiles/home-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialResult: RecordActionResult = {};

function FileField({
  id,
  driveConnected,
}: {
  id: string;
  driveConnected: boolean;
}) {
  if (!driveConnected) {
    return (
      <p className="text-sm text-muted-foreground">
        Conectează Google Drive ca să atașezi imagini sau un PDF.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Fișiere</Label>
      <Input
        id={id}
        name="file"
        type="file"
        multiple
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="h-11"
      />
      <p className="text-sm text-muted-foreground">
        Opțional. Poți adăuga mai multe imagini sau un PDF la aceeași
        înregistrare.
      </p>
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
  title,
  children,
}: {
  action: (
    previous: RecordActionResult,
    formData: FormData,
  ) => Promise<RecordActionResult>;
  profileId: string;
  title: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialResult);
  const [fileError, setFileError] = useState<string | null>(null);
  const [savingFiles, setSavingFiles] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.saved) {
      formRef.current?.reset();
    }
  }, [state]);

  async function submit(formData: FormData) {
    const files = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    formData.delete("file");
    if (files.length === 0) {
      formAction(formData);
      return;
    }

    const profileId = String(formData.get("profileId") ?? "");
    const date = String(formData.get("consultationDate") ?? "");
    const summary = String(formData.get("summary") ?? "").trim();
    if (!date) {
      setFileError("Data consultației este obligatorie.");
      return;
    }

    setFileError(null);
    setSavingFiles(true);
    let primaryId: string | null = null;
    try {
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
    } catch {
      setFileError("Înregistrarea nu a putut fi salvată. Încearcă din nou.");
    } finally {
      setSavingFiles(false);
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
      <h3 className="text-sm font-medium">{title}</h3>
      {fileError ?? state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {fileError ?? state.error}
        </p>
      ) : null}
      {children}
      <Button type="submit" className="h-11 sm:w-fit" disabled={pending || savingFiles}>
        {pending || savingFiles ? "Se salvează…" : "Salvează"}
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
          variant={panel === "consultation" ? "default" : "outline"}
          className="h-11"
          onClick={() =>
            setPanel((current) =>
              current === "consultation" ? null : "consultation",
            )
          }
        >
          Consultație
        </Button>
        <Button
          type="button"
          variant={panel === "file" ? "default" : "outline"}
          className="h-11"
          onClick={() =>
            setPanel((current) => (current === "file" ? null : "file"))
          }
        >
          Document
        </Button>
      </div>
      {panel === "consultation" ? (
        <EntryForm
          action={createConsultation}
          profileId={profileId}
          title="Consultație nouă"
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
          <FileField id={`consult-files-${profileId}`} driveConnected={driveConnected} />
        </EntryForm>
      ) : null}
      {panel === "file" ? (
        driveConnected ? (
          <HomeUpload
            people={[
              { id: profileId, display_name: profileName, idnp },
            ]}
            lockedProfileId={profileId}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Conectează Google Drive ca să încarci un document privat.
          </p>
        )
      ) : null}
    </div>
  );
}
