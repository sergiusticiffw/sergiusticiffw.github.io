import "server-only";

import { inflateRawSync } from "node:zlib";

const CENTRAL_DIR_END = 0x06054b50;
const CENTRAL_DIR_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
const MAX_UNZIPPED_BYTES = 50 * 1024 * 1024;

function readZipEntry(bytes: Uint8Array, wanted: string): Uint8Array | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = new TextDecoder("latin1");

  // The end-of-central-directory record sits in the last 64 KB.
  let endOffset = -1;
  const searchStart = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= searchStart; offset -= 1) {
    if (view.getUint32(offset, true) === CENTRAL_DIR_END) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) {
    return null;
  }

  const entryCount = view.getUint16(endOffset + 10, true);
  let offset = view.getUint32(endOffset + 16, true);

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== CENTRAL_DIR_ENTRY) {
      return null;
    }
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = ascii.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));

    if (name === wanted) {
      if (uncompressedSize > MAX_UNZIPPED_BYTES) {
        return null;
      }
      if (
        localOffset + 30 > bytes.length ||
        view.getUint32(localOffset, true) !== LOCAL_HEADER
      ) {
        return null;
      }
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) {
        return data;
      }
      if (method === 8) {
        const inflated = inflateRawSync(data, { maxOutputLength: MAX_UNZIPPED_BYTES });
        return new Uint8Array(inflated.buffer, inflated.byteOffset, inflated.byteLength);
      }
      return null;
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return null;
}

function decodeXmlEntities(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Returns the paragraphs of a .docx file as plain text, or null if unreadable. */
export function readDocxText(bytes: Uint8Array): string | null {
  const xmlBytes = readZipEntry(bytes, "word/document.xml");
  if (!xmlBytes) {
    return null;
  }
  const xml = new TextDecoder("utf-8").decode(xmlBytes);
  const text = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    // Table cells sit on one line, separated by tabs; rows end the line.
    .replace(/\n*<\/w:tc>/g, "\t")
    .replace(/<\/w:tr>/g, "\n")
    .replace(/<[^>]+>/g, "");
  return decodeXmlEntities(text)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
