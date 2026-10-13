"use client";

import { useState } from "react";

import {
  deleteRecord,
  type RecordKind,
} from "@/app/(app)/profiles/document-actions";
import { Button } from "@/components/ui/button";

export function DeleteRecordButton({
  kind,
  id,
  withFiles,
}: {
  kind: RecordKind;
  id: string;
  withFiles?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="mt-3 flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        className="h-11 sm:w-fit"
        disabled={pending}
        onClick={() => {
          const confirmed = window.confirm(
            withFiles
              ? "Ștergi înregistrarea și toate fișierele ei din Google Drive? Acțiunea nu poate fi anulată."
              : "Ștergi această înregistrare? Acțiunea nu poate fi anulată.",
          );
          if (!confirmed) {
            return;
          }
          setPending(true);
          setError(null);
          void deleteRecord(kind, id).then((result) => {
            if (result.error) {
              setError(result.error);
              setPending(false);
            }
          });
        }}
      >
        {pending ? "Se șterge…" : "Șterge înregistrarea"}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
