// Browser-only helpers that shrink photos before they reach the server.
// Vercel rejects function request bodies above 4.5 MB, so phone photos
// (often 4–12 MB) must be downscaled on the client.

/** Upper bound for one request body, with room for multipart overhead. */
export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_SIDE = 2500;
const MIN_SIDE = 1200;
const QUALITIES = [0.85, 0.75, 0.65];

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isImageFile(file: File) {
  return IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function decode(file: File) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to the <img> path
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns a JPEG no larger than MAX_UPLOAD_BYTES, scaled to at most MAX_SIDE px.
 * Small images are returned unchanged. Non-image files are returned as-is.
 */
export async function prepareUpload(file: File): Promise<File> {
  if (!isImageFile(file)) {
    return file;
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    return file;
  }

  const width = "naturalWidth" in source ? source.naturalWidth : source.width;
  const height = "naturalHeight" in source ? source.naturalHeight : source.height;
  const largest = Math.max(width, height);
  if (file.size <= MAX_UPLOAD_BYTES && largest <= MAX_SIDE) {
    return file;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return file;
  }

  let side = Math.min(MAX_SIDE, largest);
  let best: Blob | null = null;
  while (side >= MIN_SIDE) {
    const scale = side / largest;
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);

    for (const quality of QUALITIES) {
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) {
        continue;
      }
      best = blob;
      if (blob.size <= MAX_UPLOAD_BYTES) {
        side = 0;
        break;
      }
    }
    side = side > 0 ? Math.round(side * 0.75) : 0;
  }

  if ("close" in source) {
    source.close();
  }
  if (!best || best.size > MAX_UPLOAD_BYTES) {
    return file;
  }

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([best], name, { type: "image/jpeg", lastModified: file.lastModified });
}

export function uploadSizeError(file: File) {
  if (file.size <= MAX_UPLOAD_BYTES) {
    return null;
  }
  return `„${file.name}” are ${(file.size / 1024 / 1024).toFixed(1)} MB. Limita la încărcare este 3,5 MB pe fișier (fotografiile se comprimă automat).`;
}

/** Shrinks every image; returns an error for any other file still too large. */
export async function prepareUploads(
  files: File[],
): Promise<{ files: File[]; error: string | null }> {
  const prepared: File[] = [];
  for (const file of files) {
    const ready = await prepareUpload(file);
    const error = uploadSizeError(ready);
    if (error) {
      return { files: prepared, error };
    }
    prepared.push(ready);
  }
  return { files: prepared, error: null };
}
