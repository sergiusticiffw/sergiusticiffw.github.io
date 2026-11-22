"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import {
  createConsultation,
  type RecordActionResult,
} from "@/app/(app)/profiles/record-actions";
import { saveDetectedDocument } from "@/app/(app)/profiles/scan-actions";
import { DriveConnectCta } from "@/components/layout/drive-connect-cta";
import { LabRowsEditor } from "@/components/profiles/lab-rows-editor";
import {
  HomeUpload,
  type HomeUploadSaveAction,
} from "@/components/profiles/home-upload";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/form-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { prepareUploads } from "@/lib/client-image";
import { ACCEPTED_FILE_TYPES } from "@/lib/files";
import { parseLabRowsField } from "@/lib/labs";
import { recordBody } from "@/lib/validation/extraction";
import {
  DEFAULT_RECORD_CATEGORY,
  parseRecordCategory,
  RECORD_CATEGORIES,
  type RecordCategory,
} from "@/lib/record-category";

const initialResult: RecordActionResult = {};

function FileField({
  id,
  driveConnected,
  canConnectDrive,
}: {
  id: string;
  driveConnected: boolean;
  canConnectDrive: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [names, setNames] = useState<string[]>([]);

  if (!driveConnected) {
    return <DriveConnectCta canConnect={canConnectDrive} />;
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
  formId,
  children,
  onSaved,
  onPendingChange,
}: {
  action: (
    previous: RecordActionResult,
    formData: FormData,
  ) => Promise<RecordActionResult>;
  profileId: string;
  formId: string;
  children: ReactNode;
  onSaved?: () => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [state, setState] = useState<RecordActionResult>(initialResult);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function setPending(next: boolean) {
    setSaving(next);
    onPendingChange?.(next);
  }

  async function submit(formData: FormData) {
    const chosen = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    formData.delete("file");
    setFileError(null);
    setState(initialResult);
    // Show loader immediately — footer button is outside this form.
    setPending(true);

    if (chosen.length === 0) {
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
        setPending(false);
      }
      return;
    }

    const profileId = String(formData.get("profileId") ?? "");
    const date = String(formData.get("consultationDate") ?? "");
    const title = String(formData.get("title") ?? "").trim().slice(0, 160);
    const summary = String(formData.get("summary") ?? "").trim();
    const category = parseRecordCategory(formData.get("category"));
    const consultation = {
      doctorName: String(formData.get("doctorName") ?? "").trim().slice(0, 200),
      clinicName: String(formData.get("clinicName") ?? "").trim().slice(0, 200),
      specialty: String(formData.get("specialty") ?? "").trim().slice(0, 200),
      consultationDate: date,
      summary: summary.slice(0, 4000),
      recommendations: String(formData.get("recommendations") ?? "")
        .trim()
        .slice(0, 4000),
    };
    const labRows =
      category === "Analiză" ? parseLabRowsField(formData.get("labRows")) : [];
    // Keep who/where/recommendations searchable even when files are attached.
    const note = recordBody({
      idnp: "",
      extractedText: "",
      consultation,
      labTests: [],
    });
    if (!date) {
      setFileError("Data este obligatorie.");
      setPending(false);
      return;
    }
    if (!title) {
      setFileError("Titlul este obligatoriu.");
      setPending(false);
      return;
    }

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
        data.set("category", category);
        data.set("title", title);
        data.set("body", primaryId ? "" : note || summary || title);
        data.set(
          "payload",
          primaryId
            ? "{}"
            : JSON.stringify({
                idnp: "",
                extractedText: summary,
                consultation,
                labTests: labRows,
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
      setPending(false);
    }
  }

  return (
    <form
      id={formId}
      ref={formRef}
      method="post"
      encType="multipart/form-data"
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (saving) {
          return;
        }
        void submit(new FormData(event.currentTarget));
      }}
    >
      <input type="hidden" name="profileId" value={profileId} />
      {fileError ?? state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {fileError ?? state.error}
        </p>
      ) : null}
      {children}
    </form>
  );
}

function submitFormById(formId: string, pending: boolean) {
  if (pending) {
    return;
  }
  const form = document.getElementById(formId);
  if (!(form instanceof HTMLFormElement)) {
    return;
  }
  if (!form.reportValidity()) {
    return;
  }
  form.requestSubmit();
}

export function ProfileEntries({
  profileId,
  profileName,
  idnp,
  driveConnected,
  canConnectDrive = false,
}: {
  profileId: string;
  profileName: string;
  idnp: string | null;
  driveConnected: boolean;
  canConnectDrive?: boolean;
}) {
  const [panel, setPanel] = useState<"consultation" | "file" | null>(null);
  const [saveAction, setSaveAction] = useState<HomeUploadSaveAction | null>(
    null,
  );
  const [entryPending, setEntryPending] = useState(false);
  const [entryCategory, setEntryCategory] = useState<RecordCategory>(
    DEFAULT_RECORD_CATEGORY,
  );
  const entryFormId = `entry-form-${profileId}`;

  function closePanel() {
    if (saveAction?.disabled || entryPending) {
      return;
    }
    setSaveAction(null);
    setEntryCategory(DEFAULT_RECORD_CATEGORY);
    setPanel(null);
  }

  const dialogPending =
    entryPending || Boolean(saveAction?.disabled);

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
          Înregistrare
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
        title={panel === "file" ? "Document nou" : "Înregistrare nouă"}
        pending={dialogPending}
        onClose={closePanel}
        footer={
          panel === "consultation" ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={entryPending}
                onClick={closePanel}
              >
                Renunță
              </Button>
              <Button
                type="button"
                className="h-11 sm:w-fit"
                loading={entryPending}
                disabled={entryPending}
                onClick={() => submitFormById(entryFormId, entryPending)}
              >
                {entryPending ? "Se salvează…" : "Salvează"}
              </Button>
            </>
          ) : saveAction ? (
            <>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                disabled={saveAction.disabled}
                onClick={closePanel}
              >
                Renunță
              </Button>
              <Button
                type="button"
                className="h-11 sm:w-fit"
                loading={saveAction.loading}
                disabled={saveAction.disabled}
                onClick={saveAction.onSave}
              >
                {saveAction.label}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11"
              onClick={closePanel}
            >
              Renunță
            </Button>
          )
        }
      >
        {panel === "consultation" ? (
          <EntryForm
            action={createConsultation}
            profileId={profileId}
            formId={entryFormId}
            onSaved={closePanel}
            onPendingChange={setEntryPending}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`consult-category-${profileId}`}>Tip</Label>
              <Select
                id={`consult-category-${profileId}`}
                name="category"
                value={entryCategory}
                onChange={(event) =>
                  setEntryCategory(parseRecordCategory(event.target.value))
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
              <Label htmlFor={`consult-title-${profileId}`}>Titlu</Label>
              <Input
                id={`consult-title-${profileId}`}
                name="title"
                required
                maxLength={160}
                className="h-11"
                placeholder="ex. Control pediatrie"
              />
            </div>
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
            <details className="rounded-lg border px-3 py-1">
              <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
                Medic și clinică (opțional)
              </summary>
              <div className="flex flex-col gap-3 pb-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`consult-doctor-${profileId}`}>Medic</Label>
                  <Input
                    id={`consult-doctor-${profileId}`}
                    name="doctorName"
                    maxLength={200}
                    autoComplete="off"
                    placeholder="ex. Dr. Popescu"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`consult-clinic-${profileId}`}>Clinică</Label>
                  <Input
                    id={`consult-clinic-${profileId}`}
                    name="clinicName"
                    maxLength={200}
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`consult-specialty-${profileId}`}>
                    Specialitate
                  </Label>
                  <Input
                    id={`consult-specialty-${profileId}`}
                    name="specialty"
                    maxLength={200}
                    autoComplete="off"
                    placeholder="ex. Pediatrie"
                  />
                </div>
              </div>
            </details>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`consult-summary-${profileId}`}>Notă</Label>
              <Textarea
                id={`consult-summary-${profileId}`}
                name="summary"
                maxLength={4000}
                className="min-h-24"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`consult-reco-${profileId}`}>
                Recomandările medicului
              </Label>
              <Textarea
                id={`consult-reco-${profileId}`}
                name="recommendations"
                maxLength={4000}
                className="min-h-20"
                placeholder="Doar ce a spus medicul, fără interpretări."
              />
            </div>
            {entryCategory === "Analiză" ? <LabRowsEditor /> : null}
            <FileField
              id={`consult-files-${profileId}`}
              driveConnected={driveConnected}
              canConnectDrive={canConnectDrive}
            />
          </EntryForm>
        ) : null}
        {panel === "file" ? (
          <HomeUpload
            people={[{ id: profileId, display_name: profileName, idnp }]}
            lockedProfileId={profileId}
            driveConnected={driveConnected}
            canConnectDrive={canConnectDrive}
            onSaved={closePanel}
            onSaveActionChange={setSaveAction}
          />
        ) : null}
      </FormDialog>
    </div>
  );
}
