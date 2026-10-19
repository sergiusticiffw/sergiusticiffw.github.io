import "server-only";

import type { DocumentType } from "@/lib/files";
import {
  ensureDriveRoot,
  ensureFolder,
  trashDriveFile,
  uploadDriveFile,
} from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";

type StoredDocument = {
  documentId: string;
  driveFileId: string;
};

export async function storePrivateDocument(input: {
  familyId: string;
  profile: {
    id: string;
    display_name: string;
    drive_folder_id: string | null;
  };
  filename: string;
  mimeType: DocumentType;
  bytes: Uint8Array;
  size: number;
  documentDate: string;
  category: string;
  extractedText: string;
  title?: string | null;
  recordId?: string | null;
}): Promise<{ error: string } | StoredDocument> {
  const supabase = await createClient();
  let driveFileId: string | null = null;

  try {
    const root = await ensureDriveRoot(input.familyId);
    if (!root) {
      return { error: "Conectează mai întâi Google Drive." };
    }

    let profileFolderId = input.profile.drive_folder_id;
    if (!profileFolderId) {
      profileFolderId = await ensureFolder(
        root.accessToken,
        root.rootFolderId,
        input.profile.display_name,
      );
      const { error: folderError } = await supabase
        .from("profiles")
        .update({ drive_folder_id: profileFolderId })
        .eq("id", input.profile.id)
        .eq("family_id", input.familyId);
      if (folderError) {
        console.error("storePrivateDocument", folderError.code);
        return { error: "Dosarul persoanei nu a putut fi salvat." };
      }
    }

    const yearFolderId = await ensureFolder(
      root.accessToken,
      profileFolderId,
      input.documentDate.slice(0, 4),
    );
    const categoryFolderId = await ensureFolder(
      root.accessToken,
      yearFolderId,
      input.category || "Fără categorie",
    );
    driveFileId = await uploadDriveFile({
      accessToken: root.accessToken,
      parentId: categoryFolderId,
      filename: input.filename,
      mimeType: input.mimeType,
      bytes: input.bytes,
    });

    const title = input.title?.trim().slice(0, 160) || null;
    const baseRow = {
      profile_id: input.profile.id,
      drive_file_id: driveFileId,
      original_filename: input.filename,
      mime_type: input.mimeType,
      file_size: input.size,
      document_date: input.documentDate,
      category: input.category || null,
      extracted_text: input.extractedText || null,
      ...(input.recordId ? { record_id: input.recordId } : {}),
    };
    let inserted = await supabase
      .from("medical_documents")
      .insert({ ...baseRow, ...(title ? { title } : {}) })
      .select("id")
      .single();

    const missingTitle =
      (inserted.error?.code === "42703" || inserted.error?.code === "PGRST204") &&
      (inserted.error.message ?? "").toLowerCase().includes("title");
    if (missingTitle && title) {
      inserted = await supabase
        .from("medical_documents")
        .insert({
          ...baseRow,
          extracted_text: `${title}\n\n${input.extractedText}`.slice(0, 20000) || null,
        })
        .select("id")
        .single();
    }

    const { data, error } = inserted;
    if (error || !data) {
      console.error("storePrivateDocument", error?.code);
      await trashDriveFile(input.familyId, driveFileId);
      if (
        (error?.code === "42703" || error?.code === "PGRST204") &&
        input.recordId
      ) {
        return {
          error: "Aplică migrația pentru mai multe imagini la o înregistrare.",
        };
      }
      if (
        error?.code === "23514" &&
        (error.message ?? "").includes("mime_type")
      ) {
        return { error: "Aplică migrația pentru documente Word și text." };
      }
      return { error: "Documentul nu a putut fi salvat." };
    }

    return { documentId: (data as { id: string }).id, driveFileId };
  } catch (storeError) {
    console.error(
      "storePrivateDocument",
      storeError instanceof Error ? storeError.name : "unknown",
    );
    if (driveFileId) {
      await trashDriveFile(input.familyId, driveFileId).catch(() => undefined);
    }
    return { error: "Documentul nu a putut fi încărcat în Google Drive." };
  }
}

export async function discardStoredDocument(
  familyId: string,
  documentId: string,
  driveFileId: string,
) {
  const supabase = await createClient();
  const { data: extras } = await supabase
    .from("medical_documents")
    .select("drive_file_id")
    .eq("record_id", documentId);
  await supabase
    .from("consultations")
    .delete()
    .eq("source_document_id", documentId);
  await supabase.from("lab_tests").delete().eq("source_document_id", documentId);
  await supabase.from("medical_documents").delete().eq("id", documentId);
  await trashDriveFile(familyId, driveFileId).catch(() => undefined);
  for (const extra of (extras ?? []) as { drive_file_id: string }[]) {
    await trashDriveFile(familyId, extra.drive_file_id).catch(() => undefined);
  }
}
