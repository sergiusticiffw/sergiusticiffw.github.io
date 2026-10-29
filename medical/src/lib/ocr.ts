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

async function recognize(worker: Worker, bytes: Uint8Array) {
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
      const image = await renderPageAsImage(pdf, page, {
        canvasImport: () => import("@napi-rs/canvas"),
        scale: 2,
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
        console.error(
          "readPrintedText",
          error instanceof Error
            ? `${error.name}: ${error.message.slice(0, 180)}`
            : "unknown",
        );
      }
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
