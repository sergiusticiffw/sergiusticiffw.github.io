import { connection } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminFamilyId } from "@/lib/auth";
import { safeFilename } from "@/lib/files";
import { downloadDriveFile } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";

const FILE_ID = /^[A-Za-z0-9_-]{10,128}$/;

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

  const family = await getAdminFamilyId();
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
    const driveResponse = await downloadDriveFile(
      family.familyId,
      document.drive_file_id,
    );
    const download = new URL(request.url).searchParams.get("download") === "1";
    const filename = safeFilename(document.original_filename);
    return new NextResponse(driveResponse.body, {
      headers: {
        "Content-Type": document.mime_type,
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
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
