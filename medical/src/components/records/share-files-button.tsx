"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { shareRecordFiles, type ShareableFile } from "@/lib/share-files";

export function ShareFilesButton({
  files,
  title,
}: {
  files: ShareableFile[];
  title?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (files.length === 0) {
    return null;
  }

  const label =
    files.length === 1 ? "Distribuie" : `Distribuie toate (${files.length})`;

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        className="h-11 w-full sm:w-fit"
        disabled={pending}
        onClick={() => {
          setError(null);
          setPending(true);
          void shareRecordFiles(files, title)
            .then((result) => {
              if (!result.ok && !result.cancelled && result.error) {
                setError(result.error);
              }
            })
            .finally(() => setPending(false));
        }}
      >
        <ShareIcon />
        {pending ? "Se pregătesc…" : label}
      </Button>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
      aria-hidden
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
    </svg>
  );
}
