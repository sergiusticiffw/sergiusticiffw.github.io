"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";

import {
  createConsultation,
  createLabTest,
  type RecordActionResult,
} from "@/app/(app)/profiles/record-actions";
import { HomeUpload } from "@/components/profiles/home-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LAB_CATEGORIES } from "@/lib/validation/extraction";

const initialResult: RecordActionResult = {};
const selectClass =
  "h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm";

function CategorySelect({
  id,
  options,
  required = false,
}: {
  id: string;
  options: readonly string[];
  required?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>Categorie</Label>
      <select
        id={id}
        name="category"
        required={required}
        defaultValue=""
        className={selectClass}
      >
        <option value="">{required ? "Alege categoria" : "Fără categorie"}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

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
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.saved) {
      formRef.current?.reset();
    }
  }, [state]);

  function submit(formData: FormData) {
    const files = formData
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    formData.delete("file");
    for (const file of files) {
      formData.append("file", file);
    }
    formAction(formData);
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
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {children}
      <Button type="submit" className="h-11 sm:w-fit" disabled={pending}>
        {pending ? "Se salvează…" : "Salvează"}
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
  const [panel, setPanel] = useState<"consultation" | "lab" | "file" | null>(
    null,
  );

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
          variant={panel === "lab" ? "default" : "outline"}
          className="h-11"
          onClick={() => setPanel((current) => (current === "lab" ? null : "lab"))}
        >
          Analiză
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
          <Input name="doctorName" className="h-11" placeholder="Medic" />
          <Input name="clinicName" className="h-11" placeholder="Clinică" />
          <Input name="specialty" className="h-11" placeholder="Specialitate" />
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
          <Textarea name="summary" className="min-h-24" placeholder="Rezumat" />
          <Textarea
            name="recommendations"
            className="min-h-20"
            placeholder="Recomandări"
          />
          <FileField id={`consult-files-${profileId}`} driveConnected={driveConnected} />
        </EntryForm>
      ) : null}
      {panel === "lab" ? (
        <EntryForm action={createLabTest} profileId={profileId} title="Analiză nouă">
          <Input name="testName" required className="h-11" placeholder="Numele testului" />
          <CategorySelect id={`lab-category-${profileId}`} options={LAB_CATEGORIES} />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`lab-date-${profileId}`}>Data recoltării</Label>
            <Input
              id={`lab-date-${profileId}`}
              name="sampleDate"
              type="date"
              defaultValue={todayInputValue()}
              className="h-11"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="result" className="h-11" placeholder="Rezultat" />
            <Input name="unit" className="h-11" placeholder="Unitate" />
            <Input name="reference" className="h-11" placeholder="Interval" />
            <Input name="laboratory" className="h-11" placeholder="Laborator" />
          </div>
          <Textarea name="notes" className="min-h-20" placeholder="Note" />
          <FileField id={`lab-files-${profileId}`} driveConnected={driveConnected} />
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
