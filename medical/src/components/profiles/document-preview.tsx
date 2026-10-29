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
  pdf: "PDF",
  text: "Text",
  word: "Word",
  file: "Fișier",
};

function viewUrl(id: string) {
  return `/api/documents/${id}`;
}

/** Mobile browsers cannot render PDFs inside iframes (broken-file icon). */
function useNativePdfViewer() {
  const [native, setNative] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse), (max-width: 640px)");
    const sync = () => setNative(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return native;
}

function PdfGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
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
            ? "relative h-10 w-10 overflow-hidden rounded border bg-muted/40"
            : "relative h-24 w-24 overflow-hidden rounded-md border bg-muted/40"
        }
      >
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
            <PdfGlyph className={compact ? "size-5" : "size-8"} />
            {compact ? null : (
              <span className="text-[10px]">{kindLabel[kind] ?? "Fișier"}</span>
            )}
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

function PdfNativeView({ filename, url }: { filename: string; url: string }) {
  return (
    <div className="flex max-w-sm flex-col items-center gap-4 rounded-md bg-white/10 px-6 py-8 text-center">
      <PdfGlyph className="size-12 text-white/80" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-white">{filename}</p>
        <p className="text-sm text-white/70">
          Pe telefon, PDF-ul se deschide în vizualizatorul nativ.
        </p>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-medium text-neutral-950"
      >
        Deschide PDF
      </a>
    </div>
  );
}

function FileView({
  file,
  preferNativePdf,
}: {
  file: PreviewFile;
  preferNativePdf: boolean;
}) {
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
  if (kind === "pdf" && preferNativePdf) {
    return <PdfNativeView filename={file.filename} url={url} />;
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
  const preferNativePdf = useNativePdfViewer();
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const current = files[index];
  const many = files.length > 1;

  function show(next: number) {
    const file = files[next];
    setIndex(next);
    setOpen(true);
    if (
      preferNativePdf &&
      file &&
      previewKind(file.filename, file.mimeType) === "pdf"
    ) {
      window.open(viewUrl(file.id), "_blank", "noopener,noreferrer");
    }
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
              <FileView
                key={current.id}
                file={current}
                preferNativePdf={preferNativePdf}
              />
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
                        <span className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-white/10 text-[10px] text-white/80">
                          <PdfGlyph className="size-5" />
                          {kindLabel[kind] ?? "Fișier"}
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
