export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const MAX_RECORD_FILES = 8;
export const MAX_RECORD_BYTES = 24 * 1024 * 1024;

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const TEXT_MIME = "text/plain";

export type DocumentType =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | typeof DOCX_MIME
  | typeof TEXT_MIME;

export const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  DOCX_MIME,
  TEXT_MIME,
  ".txt",
  ".docx",
].join(",");

const MAX_TEXT_SNIFF = 64 * 1024;

function hasAscii(bytes: Uint8Array, needle: string, limit = bytes.length) {
  const end = Math.min(bytes.length, limit);
  outer: for (let start = 0; start + needle.length <= end; start += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (bytes[start + index] !== needle.charCodeAt(index)) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

/** Decodes a text file. UTF-8 first, then the Romanian Windows code page. */
export function decodePlainText(bytes: Uint8Array): string | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    try {
      text = new TextDecoder("windows-1250").decode(bytes);
    } catch {
      return null;
    }
  }
  return text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function looksLikeText(bytes: Uint8Array) {
  const sample = bytes.subarray(0, MAX_TEXT_SNIFF);
  for (const byte of sample) {
    // Control characters other than tab, newline and carriage return mean binary.
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0d) {
      return false;
    }
  }
  return decodePlainText(sample) !== null;
}

export function detectDocumentType(
  bytes: Uint8Array,
  filename = "",
): DocumentType | null {
  const lower = filename.toLowerCase();

  // Word documents are ZIP archives that carry word/document.xml.
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  ) {
    return hasAscii(bytes, "word/") ? DOCX_MIME : null;
  }

  if (lower.endsWith(".txt") && bytes.length > 0 && looksLikeText(bytes)) {
    return TEXT_MIME;
  }

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
    return { error: "Alege un PDF, o fotografie, un fișier Word sau text." };
  }
  if (entry.size > MAX_DOCUMENT_BYTES) {
    return { error: "Fișierul depășește 10 MB." };
  }

  const bytes = new Uint8Array(await entry.arrayBuffer());
  const mimeType = detectDocumentType(bytes, entry.name);
  if (!mimeType) {
    return {
      error:
        "Sunt permise doar PDF, JPEG, PNG, WebP, Word (.docx) și text (.txt).",
    };
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
    return { error: "Alege cel puțin un fișier." };
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
