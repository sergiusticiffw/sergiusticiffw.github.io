export type ShareableFile = {
  id: string;
  filename: string;
  mimeType: string | null;
};

function viewUrl(id: string) {
  return `/api/documents/${id}`;
}

function downloadUrl(id: string) {
  return `${viewUrl(id)}?download=1`;
}

function safeName(filename: string) {
  const cleaned = filename.replace(/[\\/]/g, "_").trim();
  return cleaned || "document";
}

async function fetchAsFile(file: ShareableFile): Promise<File> {
  const response = await fetch(viewUrl(file.id), {
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Fișierul nu a putut fi încărcat pentru distribuire.");
  }
  const blob = await response.blob();
  const type =
    file.mimeType?.trim() ||
    blob.type ||
    response.headers.get("Content-Type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  return new File([blob], safeName(file.filename), { type });
}

export function canShareFiles() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function"
  );
}

function downloadFiles(files: ShareableFile[]) {
  for (const [index, file] of files.entries()) {
    window.setTimeout(() => {
      const link = document.createElement("a");
      link.href = downloadUrl(file.id);
      link.download = safeName(file.filename);
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, index * 350);
  }
}

/** Share one file, or all files when several are attached to the record. */
export async function shareRecordFiles(
  files: ShareableFile[],
  title?: string,
): Promise<{ ok: true } | { ok: false; error: string; cancelled?: boolean }> {
  if (files.length === 0) {
    return { ok: false, error: "Nu există fișiere de distribuit." };
  }

  if (!canShareFiles()) {
    downloadFiles(files);
    return { ok: true };
  }

  try {
    const shared = await Promise.all(files.map((file) => fetchAsFile(file)));
    const payload: ShareData = {
      files: shared,
      title: title?.trim() || shared[0]?.name || "Document",
    };
    if (!navigator.canShare(payload)) {
      downloadFiles(files);
      return { ok: true };
    }
    await navigator.share(payload);
    return { ok: true };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "", cancelled: true };
    }
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : "Fișierele nu au putut fi distribuite.",
    };
  }
}
