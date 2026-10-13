export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_RECORD_FILES = 8;
export const MAX_RECORD_BYTES = 24 * 1024 * 1024;

export type DocumentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export function detectDocumentType(bytes: Uint8Array): DocumentType | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function safeFilename(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "document";
  const cleaned = base.replace(/[\r\n"]/g, "").trim().slice(0, 255);
  return cleaned || "document";
}

function isUploadedFile(
  value: { error: string } | {
    bytes: Uint8Array;
    mimeType: DocumentType;
    filename: string;
    size: number;
  },
): value is {
  bytes: Uint8Array;
  mimeType: DocumentType;
  filename: string;
  size: number;
} {
  return "bytes" in value && value.bytes instanceof Uint8Array;
}

export async function readUploadedFile(entry: FormDataEntryValue | null) {
  if (!(entry instanceof File) || entry.size === 0) {
    return { error: "Alege un PDF sau o fotografie." };
  }
  if (entry.size > MAX_DOCUMENT_BYTES) {
    return { error: "Fișierul depășește 10 MB." };
  }

  const bytes = new Uint8Array(await entry.arrayBuffer());
  const mimeType = detectDocumentType(bytes);
  if (!mimeType) {
    return { error: "Sunt permise doar PDF, JPEG, PNG și WebP." };
  }

  return {
    bytes,
    mimeType,
    filename: safeFilename(entry.name),
    size: entry.size,
  };
}

export async function readUploadedFiles(
  entries: FormDataEntryValue[],
): Promise<
  | { error: string }
  | {
      files: {
        bytes: Uint8Array;
        mimeType: DocumentType;
        filename: string;
        size: number;
      }[];
    }
> {
  const files = entries.filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
  if (files.length === 0) {
    return { error: "Alege cel puțin o imagine sau un PDF." };
  }
  if (files.length > MAX_RECORD_FILES) {
    return { error: "Poți adăuga cel mult 8 fișiere la o înregistrare." };
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_RECORD_BYTES) {
    return { error: "Fișierele depășesc 24 MB împreună." };
  }

  const uploaded: {
    bytes: Uint8Array;
    mimeType: DocumentType;
    filename: string;
    size: number;
  }[] = [];
  for (const file of files) {
    const read = await readUploadedFile(file);
    if (!isUploadedFile(read)) {
      return { error: read.error };
    }
    uploaded.push(read);
  }

  return { files: uploaded };
}
