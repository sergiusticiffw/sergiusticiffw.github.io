"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deleteRecord,
  type RecordKind,
} from "@/app/(app)/profiles/document-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { requireSensitiveUnlock } from "@/lib/sensitive-action";

export function DeleteRecordButton({
  kind,
  id,
  withFiles,
  compact = false,
  afterHref,
}: {
  kind: RecordKind;
  id: string;
  withFiles?: boolean;
  compact?: boolean;
  afterHref?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onConfirm() {
    setPending(true);
    setError(null);
    const unlock = await requireSensitiveUnlock();
    if (unlock.error) {
      setError(unlock.error);
      setPending(false);
      return;
    }
    const result = await deleteRecord(kind, id);
    if (result.error) {
      setError(result.error);
      setPending(false);
      return;
    }
    setOpen(false);
    if (afterHref) {
      router.push(afterHref);
      return;
    }
    setPending(false);
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        className={compact ? "h-7 px-2 text-xs sm:w-fit" : "h-11 w-full"}
        disabled={pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {pending ? "Se șterge…" : compact ? "Șterge" : "Șterge"}
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
    </>
  );
}
