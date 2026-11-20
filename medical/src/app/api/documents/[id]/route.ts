import { connection } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getFamilyAccess } from "@/lib/auth";
import { safeFilename } from "@/lib/files";
import { downloadDriveFile } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";

const FILE_ID = /^[A-Za-z0-9_-]{10,128}$/;

// Medical files must not linger in the browser cache after logout or after
// access is revoked, so nothing here is stored on the device.
const NO_STORE = "private, no-store";

/** RFC 6266 / 5987 header value that survives Romanian diacritics. */
function contentDisposition(kind: "inline" | "attachment", filename: string) {
  const ascii =
    filename
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7e]/g, "_")
      .replace(/["\\;]/g, "_")
      .trim() || "document";
  const encoded = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** Non-PDF responses never need scripts, frames or network access. */
function sandboxPolicy(mimeType: string) {
  return mimeType === "application/pdf"
    ? undefined
    : "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  await connection();
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Documentul nu este valid." },
      { status: 400 },
    );
  }

  const family = await getFamilyAccess();
  if (!family.familyId) {
    return NextResponse.json(
      { error: "Autentificare necesară." },
      { status: 401 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medical_documents")
    .select("drive_file_id, original_filename, mime_type, profile_id")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("documentDownload", error.code);
    return NextResponse.json(
      { error: "Documentul nu poate fi deschis." },
      { status: 503 },
    );
  }

  const document = data as {
    drive_file_id: string;
    original_filename: string;
    mime_type: string;
    profile_id: string;
  } | null;

  if (!document || !FILE_ID.test(document.drive_file_id)) {
    return NextResponse.json(
      { error: "Documentul nu a fost găsit." },
      { status: 404 },
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", document.profile_id)
    .eq("family_id", family.familyId)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Documentul nu a fost găsit." },
      { status: 404 },
    );
  }

  try {
    const etag = `"${document.drive_file_id}"`;
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": NO_STORE,
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const driveResponse = await downloadDriveFile(
      family.familyId,
      document.drive_file_id,
    );
    const download = new URL(request.url).searchParams.get("download") === "1";
    const filename = safeFilename(document.original_filename);
    const policy = sandboxPolicy(document.mime_type);
    return new NextResponse(driveResponse.body, {
      headers: {
        "Content-Type":
          document.mime_type === "text/plain"
            ? "text/plain; charset=utf-8"
            : document.mime_type,
        "Content-Disposition": contentDisposition(
          download ? "attachment" : "inline",
          filename,
        ),
        "Cache-Control": NO_STORE,
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
        ...(policy ? { "Content-Security-Policy": policy } : {}),
      },
    });
  } catch (downloadError) {
    console.error(
      "documentDownload",
      downloadError instanceof Error ? downloadError.name : "unknown",
    );
    return NextResponse.json(
      { error: "Documentul nu poate fi deschis." },
      { status: 503 },
    );
  }
}
