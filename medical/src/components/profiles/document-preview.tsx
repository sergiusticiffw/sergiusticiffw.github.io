"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type PreviewFile = {
  id: string;
  filename: string;
  mimeType: string | null;
};

function previewKind(filename: string, mimeType: string | null) {
  const lower = filename.toLowerCase();
  if (mimeType?.startsWith("image/")) {
    return "image";
  }
  if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
    return "pdf";
  }
  if (mimeType === "text/plain" || lower.endsWith(".txt")) {
    return "text";
  }
  if (mimeType?.includes("wordprocessingml") || lower.endsWith(".docx")) {
    return "word";
  }
  return "file";
}

const kindLabel: Record<string, string> = {
  text: "Text",
  word: "Word",
  file: "Fișier",
};

function viewUrl(id: string) {
  return `/api/documents/${id}`;
}

function FileThumb({
  file,
  compact,
  onOpen,
}: {
  file: PreviewFile;
  compact: boolean;
  onOpen: () => void;
}) {
  const kind = previewKind(file.filename, file.mimeType);
  const url = viewUrl(file.id);
  return (
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
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : kind === "pdf" ? (
          <iframe
            title=""
            src={`${url}#toolbar=0&navpanes=0`}
            className={
              compact
                ? "pointer-events-none h-40 w-40 origin-top-left scale-[0.25]"
                : "pointer-events-none h-48 w-48 origin-top-left scale-50"
            }
            tabIndex={-1}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
            {kindLabel[kind] ?? "Fișier"}
          </span>
        )}
        <button
          type="button"
          className="absolute inset-0"
          aria-label={`Vezi ${file.filename}`}
          onClick={onOpen}
        />
      </div>
      {compact ? null : (
        <span className="truncate text-xs text-muted-foreground">{file.filename}</span>
      )}
    </div>
  );
}

function FileView({ file }: { file: PreviewFile }) {
  const kind = previewKind(file.filename, file.mimeType);
  const url = viewUrl(file.id);
  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={file.filename}
        className="max-h-full max-w-full object-contain"
      />
    );
  }
  if (kind === "word" || kind === "file") {
    return (
      <p className="max-w-sm rounded-md bg-white/10 p-4 text-center text-sm text-white/80">
        Acest tip de fișier nu se poate afișa aici. Folosește „Descarcă” ca să
        îl deschizi pe telefon sau pe calculator.
      </p>
    );
  }
  return (
    <iframe
      title={file.filename}
      src={url}
      className="h-full w-full rounded-md bg-white"
    />
  );
}

export function DocumentGallery({
  files,
  compact = false,
}: {
  files: PreviewFile[];
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const current = files[index];
  const many = files.length > 1;

  function show(next: number) {
    setIndex(next);
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  const step = useCallback((delta: number) => {
    setIndex((currentIndex) => {
      const length = files.length;
      if (length === 0) {
        return 0;
      }
      return (currentIndex + delta + length) % length;
    });
  }, [files.length]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (files.length === 0) {
      setOpen(false);
      return;
    }
    if (index > files.length - 1) {
      setIndex(files.length - 1);
    }
  }, [files.length, index]);

  useEffect(() => {
    if (!open || !many) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        step(-1);
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        step(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, many, step]);

  if (files.length === 0) {
    return null;
  }

  return (
    <>
      <ul className="flex flex-wrap gap-1">
        {files.map((file, fileIndex) => (
          <li key={file.id}>
            <FileThumb
              file={file}
              compact={compact}
              onOpen={() => show(fileIndex)}
            />
          </li>
        ))}
      </ul>
      <dialog
        ref={dialogRef}
        className="m-0 h-dvh max-h-dvh w-full max-w-none border-0 bg-neutral-950 p-0 text-white backdrop:bg-black/80 open:flex open:flex-col sm:m-auto sm:h-[min(92dvh,52rem)] sm:max-h-[92dvh] sm:w-[min(100%-1.5rem,56rem)] sm:rounded-2xl"
        onClose={close}
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            close();
          }
        }}
      >
        {current ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-3 sm:pt-3">
              <button
                type="button"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
                aria-label="Închide"
                onClick={close}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <div className="min-w-0 flex-1 text-center">
                {many ? (
                  <p className="text-sm font-medium">
                    {index + 1} din {files.length}
                  </p>
                ) : (
                  <p className="truncate text-sm font-medium">{current.filename}</p>
                )}
                {many ? (
                  <p className="truncate text-xs text-white/60">{current.filename}</p>
                ) : null}
              </div>
              <a
                href={`${viewUrl(current.id)}?download=1`}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white/90 hover:bg-white/10"
                aria-label="Descarcă"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5" aria-hidden>
                  <path d="M12 3v12" />
                  <path d="m7 11 5 5 5-5" />
                  <path d="M5 21h14" />
                </svg>
              </a>
            </div>
            <div
              className="relative flex min-h-0 flex-1 items-center justify-center px-1"
              onTouchStart={(event) => {
                touchX.current = event.changedTouches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                if (touchX.current == null || !many) {
                  return;
                }
                const moved =
                  (event.changedTouches[0]?.clientX ?? touchX.current) -
                  touchX.current;
                touchX.current = null;
                if (moved > 48) {
                  step(-1);
                } else if (moved < -48) {
                  step(1);
                }
              }}
            >
              {many ? (
                <>
                  <button
                    type="button"
                    className="absolute top-1/2 left-1 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/55"
                    aria-label="Fișierul anterior"
                    onClick={() => step(-1)}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="absolute top-1/2 right-1 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-2xl text-white hover:bg-black/55"
                    aria-label="Fișierul următor"
                    onClick={() => step(1)}
                  >
                    ›
                  </button>
                </>
              ) : null}
              <FileView key={current.id} file={current} />
            </div>
            {many ? (
              <div className="flex gap-2 overflow-x-auto px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {files.map((file, fileIndex) => {
                  const kind = previewKind(file.filename, file.mimeType);
                  const selected = fileIndex === index;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      aria-label={`${file.filename}, ${fileIndex + 1} din ${files.length}`}
                      aria-current={selected}
                      className={
                        selected
                          ? "size-14 shrink-0 overflow-hidden rounded-lg ring-2 ring-white"
                          : "size-14 shrink-0 overflow-hidden rounded-lg opacity-50"
                      }
                      onClick={() => setIndex(fileIndex)}
                    >
                      {kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={viewUrl(file.id)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-white/10 text-[10px] text-white/80">
                          {kindLabel[kind] ?? "PDF"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]" />
            )}
          </div>
        ) : null}
      </dialog>
    </>
  );
}
