"use client";

import { useState } from "react";

import {
  deleteRecord,
  type RecordKind,
} from "@/app/(app)/profiles/document-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteRecordButton({
  kind,
  id,
  withFiles,
  compact = false,
}: {
  kind: RecordKind;
  id: string;
  withFiles?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    setError(null);
    const result = await deleteRecord(kind, id);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    // The page revalidates and this card disappears; keep the dialog closed.
    setOpen(false);
    setPending(false);
  }

  return (
    <div className={compact ? "flex flex-col gap-1" : "mt-3 flex flex-col gap-1"}>
      <Button
        type="button"
        variant="outline"
        className={compact ? "h-7 px-2 text-xs sm:w-fit" : "h-11 sm:w-fit"}
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {pending ? "Se șterge…" : compact ? "Șterge" : "Șterge înregistrarea"}
      </Button>
      <ConfirmDialog
        open={open}
        title="Ștergi înregistrarea?"
        description={
          withFiles
            ? "Se șterg și toate fișierele ei din Google Drive. Acțiunea nu poate fi anulată."
            : "Acțiunea nu poate fi anulată."
        }
        pending={pending}
        error={error}
        onConfirm={() => {
          void onConfirm();
        }}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
