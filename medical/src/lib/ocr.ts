import "server-only";

import path from "node:path";
import { tmpdir } from "node:os";
import { createWorker, type Worker } from "tesseract.js";
import { extractText, getDocumentProxy, renderPageAsImage } from "unpdf";

import { decodePlainText, DOCX_MIME, TEXT_MIME } from "@/lib/files";
import { readDocxText } from "@/lib/office-text";
import {
  emptyConsultation,
  MAX_EXTRACTED_TEXT,
  type Extraction,
} from "@/lib/validation/extraction";

const MIN_PDF_TEXT = 40;
const MAX_PDF_PAGES = 10;
// Keep below the 60s function limit so a stuck worker surfaces as an error
// instead of a gateway timeout. tesseract.js never rejects when its worker
// thread crashes, so this is the only safety net.
const OCR_BUDGET_MS = 45_000;

function withDeadline<T>(promise: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return Promise.reject(new Error("timeout"));
  }
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), remaining);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function findIdnp(text: string) {
  return text.match(/(?<!\d)(\d{13})(?!\d)/)?.[1] ?? "";
}

// A phone photo is ~12 MP and the client already shrinks to 2500 px. Anything
// far beyond that is either an attack or unusable, and would exhaust memory.
const MAX_IMAGE_PIXELS = 36_000_000;
const MAX_RENDER_PIXELS = 12_000_000;

function imageDimensions(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));

  // PNG: IHDR holds width and height right after the signature.
  if (bytes.length >= 24 && bytes[0] === 0x89 && ascii(1, 3) === "PNG") {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }

  // JPEG: walk the segments until a start-of-frame marker.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xff) {
        offset += 1;
        continue;
      }
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
        offset += 2;
        continue;
      }
      if (
        marker >= 0xc0 &&
        marker <= 0xcf &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  }

  // WebP: lossy (VP8 ), lossless (VP8L) or extended (VP8X).
  if (bytes.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8 ") {
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const bits = view.getUint32(21, true);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      const read24 = (offset: number) =>
        bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
      return { width: read24(24) + 1, height: read24(27) + 1 };
    }
  }

  return null;
}

function assertImageSize(bytes: Uint8Array) {
  const size = imageDimensions(bytes);
  if (size && size.width * size.height > MAX_IMAGE_PIXELS) {
    throw new Error("too_large");
  }
}

async function recognize(worker: Worker, bytes: Uint8Array) {
  assertImageSize(bytes);
  const result = await worker.recognize(Buffer.from(bytes));
  return result.data.text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

async function readPdf(
  bytes: Uint8Array,
  ocr: (bytes: Uint8Array) => Promise<string>,
) {
  const pdf = await getDocumentProxy(bytes);
  try {
    const extracted = await extractText(pdf, { mergePages: true });
    const embedded = (typeof extracted.text === "string" ? extracted.text : "").trim();
    if (embedded.length >= MIN_PDF_TEXT) {
      return embedded;
    }

    const pages = Math.min(extracted.totalPages, MAX_PDF_PAGES);
    const recognized: string[] = [];
    for (let page = 1; page <= pages; page += 1) {
      // Pick the render scale from the page size so a huge page cannot blow up memory.
      const viewport = (await pdf.getPage(page)).getViewport({ scale: 1 });
      const area = viewport.width * viewport.height;
      if (!(area > 0)) {
        continue;
      }
      const scale = Math.min(2, Math.sqrt(MAX_RENDER_PIXELS / area));
      if (scale < 0.25) {
        throw new Error("too_large");
      }
      const image = await renderPageAsImage(pdf, page, {
        canvasImport: () => import("@napi-rs/canvas"),
        scale,
      });
      const text = await ocr(new Uint8Array(image));
      if (text) {
        recognized.push(text);
      }
    }
    if (extracted.totalPages > MAX_PDF_PAGES) {
      recognized.push("Restul paginilor nu a fost citit.");
    }
    return recognized.join("\n\n");
  } finally {
    await (pdf as { destroy?: () => Promise<void> }).destroy?.();
  }
}

export async function readPrintedText(
  files: { bytes: Uint8Array; mimeType: string }[],
): Promise<Extraction> {
  const workers: Worker[] = [];
  const deadline = Date.now() + OCR_BUDGET_MS;
  let timedOut = false;
  let tooLarge = false;

  async function ocr(bytes: Uint8Array) {
    const current = workers[0];
    if (current) {
      return withDeadline(recognize(current, bytes), deadline);
    }
    const created = await withDeadline(
      createWorker("ron+eng", 1, {
        cachePath: path.join(tmpdir(), "tesseract-medical"),
        langPath: path.join(process.cwd(), "ocr"),
        gzip: true,
      }),
      deadline,
    );
    workers.push(created);
    await withDeadline(
      created.setParameters({ preserve_interword_spaces: "1" }),
      deadline,
    );
    return withDeadline(recognize(created, bytes), deadline);
  }

  try {
    const parts: string[] = [];
    for (const file of files) {
      try {
        const text =
          file.mimeType === TEXT_MIME
            ? (decodePlainText(file.bytes) ?? "")
            : file.mimeType === DOCX_MIME
              ? (readDocxText(file.bytes) ?? "")
              : file.mimeType === "application/pdf"
                ? await readPdf(file.bytes, ocr)
                : await ocr(file.bytes);
        if (text.trim()) {
          parts.push(text.trim());
        }
      } catch (error) {
        if (error instanceof Error && error.message === "timeout") {
          timedOut = true;
        }
        if (error instanceof Error && error.message === "too_large") {
          tooLarge = true;
        }
        console.error(
          "readPrintedText",
          error instanceof Error
            ? `${error.name}: ${error.message.slice(0, 180)}`
            : "unknown",
        );
      }
    }

    if (tooLarge && parts.length === 0) {
      throw new Error("too_large");
    }
    if (timedOut && parts.length === 0) {
      throw new Error("timeout");
    }

    const extractedText = parts.join("\n\n").slice(0, MAX_EXTRACTED_TEXT).trim();
    if (!extractedText) {
      throw new Error("empty");
    }

    return {
      idnp: findIdnp(extractedText),
      extractedText,
      consultation: emptyConsultation(),
      labTests: [],
    };
  } finally {
    await workers[0]?.terminate();
  }
}
