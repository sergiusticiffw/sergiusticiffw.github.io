"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  updateRecord,
  type RecordKind,
} from "@/app/(app)/profiles/document-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function EditRecordButton({
  kind,
  id,
  title,
  date,
  body,
}: {
  kind: RecordKind;
  id: string;
  title: string;
  date: string;
  body: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDate, setDraftDate] = useState(date);
  const [draftBody, setDraftBody] = useState(body);

  function openForm() {
    setDraftTitle(title);
    setDraftDate(date);
    setDraftBody(body);
    setError(null);
    setOpen(true);
  }

  async function onSave() {
    setPending(true);
    setError(null);
    const result = await updateRecord(kind, id, {
      title: draftTitle,
      date: draftDate,
      body: draftBody,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="contents">
      <Button
        type="button"
        variant="outline"
        className="h-7 px-2 text-xs sm:w-fit"
        disabled={pending}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openForm();
        }}
      >
        {open ? "Închide" : "Modifică"}
      </Button>
      {open ? (
        <form
          className="flex basis-full flex-col gap-2 border-t pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
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
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="h-9 sm:w-fit" disabled={pending}>
            {pending ? "Se salvează…" : "Salvează"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
