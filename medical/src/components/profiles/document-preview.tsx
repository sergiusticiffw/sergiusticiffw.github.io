"use client";

import { useRef } from "react";

function previewKind(filename: string, mimeType: string | null) {
  if (mimeType?.startsWith("image/")) {
    return "image";
  }
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }
  return "file";
}

export function DocumentPreview({
  id,
  filename,
  mimeType,
  compact = false,
}: {
  id: string;
  filename: string;
  mimeType: string | null;
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const kind = previewKind(filename, mimeType);
  const viewUrl = `/api/documents/${id}`;
  const pdfUrl = `${viewUrl}#toolbar=0&navpanes=0`;

  return (
    <>
      <div className={compact ? "w-10" : "flex w-24 flex-col gap-1"}>
        <div
          className={
            compact
              ? "relative h-10 w-10 overflow-hidden rounded border"
              : "relative h-24 w-24 overflow-hidden rounded-md border"
          }
        >
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={viewUrl} alt="" className="h-full w-full object-cover" />
          ) : kind === "pdf" ? (
            <iframe
              title=""
              src={pdfUrl}
              className={
                compact
                  ? "pointer-events-none h-40 w-40 origin-top-left scale-[0.25]"
                  : "pointer-events-none h-48 w-48 origin-top-left scale-50"
              }
              tabIndex={-1}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
              Fișier
            </span>
          )}
          <button
            type="button"
            className="absolute inset-0"
            aria-label={`Vezi ${filename}`}
            onClick={() => dialogRef.current?.showModal()}
          />
        </div>
        {compact ? null : (
          <span className="truncate text-xs text-muted-foreground">{filename}</span>
        )}
      </div>
      <dialog
        ref={dialogRef}
        className="w-[min(100%-2rem,56rem)] rounded-xl border bg-card p-4 text-card-foreground backdrop:bg-black/50"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            dialogRef.current.close();
          }
        }}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <p className="text-sm font-medium">{filename}</p>
          <div className="flex gap-2">
            <a
              href={`${viewUrl}?download=1`}
              className="inline-flex h-9 items-center rounded-lg border px-3 text-sm"
            >
              Descarcă
            </a>
            <button
              type="button"
              className="inline-flex h-9 items-center rounded-lg border px-3 text-sm"
              onClick={() => dialogRef.current?.close()}
            >
              Închide
            </button>
          </div>
        </div>
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={viewUrl} alt={filename} className="max-h-[75vh] w-full object-contain" />
        ) : (
          <iframe title={filename} src={viewUrl} className="h-[75vh] w-full rounded-md border" />
        )}
      </dialog>
    </>
  );
}
