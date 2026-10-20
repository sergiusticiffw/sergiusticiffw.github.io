"use server";

import { revalidateApp } from "@/lib/data-cache";

import { requireProfileWriter } from "@/lib/auth";
import { isUploadedFile, MAX_RECORD_FILES, readUploadedFile } from "@/lib/files";
import { trashDriveFile } from "@/lib/google-drive";
import { replacePrivateFile, storePrivateDocument } from "@/lib/store-document";
import { createClient } from "@/lib/supabase/server";
import { profileIdSchema } from "@/lib/validation/profile";

export type DocumentActionResult = {
  error?: string;
  recordId?: string;
};

const recordKinds = ["document", "consultation", "lab"] as const;
export type RecordKind = (typeof recordKinds)[number];

export async function deleteRecord(
  kind: RecordKind,
  id: string,
): Promise<DocumentActionResult> {
  if (!recordKinds.includes(kind)) {
    return { error: "Înregistrarea nu este validă." };
  }
  if (kind === "document") {
    return deleteDocument(id);
  }

  const parsedId = profileIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { error: "Înregistrarea nu este validă." };
  }

  const supabase = await createClient();
  const table = kind === "consultation" ? "consultations" : "lab_tests";
  const { data, error } = await supabase
    .from(table)
    .select("id, profile_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error || !data) {
    return { error: "Înregistrarea nu a fost găsită." };
  }

  const row = data as { id: string; profile_id: string };
  const family = await requireProfileWriter(row.profile_id);
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", row.profile_id)
    .eq("family_id", family.familyId)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Înregistrarea nu a fost găsită." };
  }

  const { error: removeError } = await supabase
    .from(table)
    .delete()
    .eq("id", row.id);
  if (removeError) {
    console.error("deleteRecord", removeError.code);
    return { error: "Înregistrarea nu a putut fi ștearsă." };
  }

  revalidateRecord(row.profile_id);
  return {};
}

function validRecordDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function updateRecord(
  kind: RecordKind,
  id: string,
  input: { title: string; date: string; body: string },
): Promise<DocumentActionResult> {
  if (!recordKinds.includes(kind)) {
    return { error: "Înregistrarea nu este validă." };
  }
  const parsedId = profileIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { error: "Înregistrarea nu este validă." };
  }

  const title = input.title.trim().slice(0, 160);
  const body = input.body.trim().slice(0, 20000);
  const date = input.date.trim();
  if (!validRecordDate(date)) {
    return { error: "Data nu este validă." };
  }
  if (kind !== "consultation" && !title) {
    return {
      error: kind === "lab" ? "Numele analizei este obligatoriu." : "Titlul este obligatoriu.",
    };
  }
  if (kind === "consultation" && !body) {
    return { error: "Nota este obligatorie." };
  }

  const supabase = await createClient();
  const table =
    kind === "document"
      ? "medical_documents"
      : kind === "consultation"
        ? "consultations"
        : "lab_tests";
  const { data, error } = await supabase
    .from(table)
    .select("id, profile_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error || !data) {
    return { error: "Înregistrarea nu a fost găsită." };
  }

  const row = data as { id: string; profile_id: string };
  const family = await requireProfileWriter(row.profile_id);
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", row.profile_id)
    .eq("family_id", family.familyId)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Înregistrarea nu a fost găsită." };
  }

  const changes =
    kind === "document"
      ? { title, document_date: date, extracted_text: body || null }
      : kind === "consultation"
        ? { consultation_date: date, summary: body }
        : { test_name: title, sample_date: date, result_text: body || null };

  const updated = await supabase.from(table).update(changes).eq("id", row.id);
  const missingTitle =
    kind === "document" &&
    (updated.error?.code === "42703" || updated.error?.code === "PGRST204") &&
    (updated.error.message ?? "").toLowerCase().includes("title");
  const saved = missingTitle
    ? await supabase
        .from(table)
        .update({
          document_date: date,
          extracted_text: `${title}\n\n${body}`.trim().slice(0, 20000) || null,
        })
        .eq("id", row.id)
    : updated;
  if (saved.error) {
    console.error("updateRecord", saved.error.code);
    return { error: "Înregistrarea nu a putut fi modificată." };
  }

  revalidateRecord(row.profile_id);
  return {};
}

export async function deleteDocument(id: string): Promise<DocumentActionResult> {
  const parsedId = profileIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { error: "Documentul nu este valid." };
  }

  const supabase = await createClient();
  const withRecord = await supabase
    .from("medical_documents")
    .select("id, drive_file_id, profile_id, record_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  const missingRecordColumn =
    withRecord.error?.code === "42703" || withRecord.error?.code === "PGRST204";
  const loaded = missingRecordColumn
    ? await supabase
        .from("medical_documents")
        .select("id, drive_file_id, profile_id")
        .eq("id", parsedId.data)
        .maybeSingle()
    : withRecord;

  if (loaded.error || !loaded.data) {
    return { error: "Documentul nu a fost găsit." };
  }

  const document = loaded.data as {
    id: string;
    drive_file_id: string;
    profile_id: string;
    record_id?: string | null;
  };
  const family = await requireProfileWriter(document.profile_id);
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const recordId = document.record_id ?? document.id;
  const { data: related, error: relatedError } = await supabase
    .from("medical_documents")
    .select("id, drive_file_id")
    .or(`id.eq.${recordId},record_id.eq.${recordId}`);
  const files =
    relatedError || !related
      ? [{ id: document.id, drive_file_id: document.drive_file_id }]
      : (related as { id: string; drive_file_id: string }[]);

  try {
    for (const file of files) {
      await trashDriveFile(family.familyId, file.drive_file_id);
    }
  } catch (deleteError) {
    console.error(
      "deleteDocument",
      deleteError instanceof Error ? deleteError.name : "unknown",
    );
    return { error: "Documentul nu a putut fi șters din Google Drive." };
  }

  const [consultationsDelete, labsDelete] = await Promise.all([
    supabase.from("consultations").delete().eq("source_document_id", recordId),
    supabase.from("lab_tests").delete().eq("source_document_id", recordId),
  ]);
  const childError = consultationsDelete.error ?? labsDelete.error;
  if (
    childError &&
    childError.code !== "42703" &&
    childError.code !== "PGRST204"
  ) {
    console.error("deleteDocument", childError.code);
    return { error: "Înregistrările extrase nu au putut fi șterse." };
  }

  const { error: removeError } = await supabase
    .from("medical_documents")
    .delete()
    .eq("id", recordId);

  if (removeError) {
    console.error("deleteDocument", removeError.code);
    return { error: "Documentul nu a putut fi șters." };
  }

  revalidateRecord(document.profile_id);
  return {};
}

type FileRow = {
  id: string;
  drive_file_id: string;
  profile_id: string;
  record_id?: string | null;
  original_filename?: string;
  document_date?: string | null;
  category?: string | null;
  title?: string | null;
  extracted_text?: string | null;
};

async function loadDocumentFile(id: string) {
  const parsedId = profileIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { error: "Documentul nu este valid." };
  }

  const supabase = await createClient();
  const withRecord = await supabase
    .from("medical_documents")
    .select(
      "id, drive_file_id, profile_id, record_id, original_filename, document_date, category, title, extracted_text",
    )
    .eq("id", parsedId.data)
    .maybeSingle();
  const missingColumn =
    withRecord.error?.code === "42703" || withRecord.error?.code === "PGRST204";
  const loaded = missingColumn
    ? await supabase
        .from("medical_documents")
        .select(
          "id, drive_file_id, profile_id, original_filename, document_date, category, extracted_text",
        )
        .eq("id", parsedId.data)
        .maybeSingle()
    : withRecord;

  if (loaded.error || !loaded.data) {
    return { error: "Documentul nu a fost găsit." };
  }

  const document = loaded.data as FileRow;
  const family = await requireProfileWriter(document.profile_id);
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  return { supabase, document, familyId: family.familyId };
}

export async function deleteRecordFile(
  id: string,
): Promise<DocumentActionResult> {
  const loaded = await loadDocumentFile(id);
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const { supabase, document, familyId } = loaded;

  const recordId = document.record_id ?? document.id;
  const related = await supabase
    .from("medical_documents")
    .select("id, drive_file_id, record_id")
    .or(`id.eq.${recordId},record_id.eq.${recordId}`);
  const files =
    related.error || !related.data
      ? [{ id: document.id, drive_file_id: document.drive_file_id, record_id: document.record_id }]
      : (related.data as {
          id: string;
          drive_file_id: string;
          record_id: string | null;
        }[]);

  if (files.length <= 1) {
    return deleteDocument(document.id);
  }

  const extras = files.filter((file) => file.id !== document.id);
  const isPrimary = !document.record_id;

  if (isPrimary) {
    const successor = extras[0];
    if (!successor) {
      return deleteDocument(document.id);
    }
    const promoted = await supabase
      .from("medical_documents")
      .update({
        record_id: null,
        title: document.title ?? null,
        document_date: document.document_date ?? null,
        category: document.category ?? null,
        extracted_text: document.extracted_text ?? null,
      })
      .eq("id", successor.id);
    const missingTitle =
      (promoted.error?.code === "42703" || promoted.error?.code === "PGRST204") &&
      (promoted.error.message ?? "").toLowerCase().includes("title");
    if (missingTitle) {
      const retry = await supabase
        .from("medical_documents")
        .update({
          record_id: null,
          document_date: document.document_date ?? null,
          category: document.category ?? null,
          extracted_text: document.extracted_text ?? null,
        })
        .eq("id", successor.id);
      if (retry.error) {
        console.error("deleteRecordFile", retry.error.code);
        return { error: "Fișierul nu a putut fi șters." };
      }
    } else if (promoted.error) {
      console.error("deleteRecordFile", promoted.error.code);
      return { error: "Fișierul nu a putut fi șters." };
    }

    const moved = await supabase
      .from("medical_documents")
      .update({ record_id: successor.id })
      .eq("record_id", document.id);
    if (moved.error) {
      console.error("deleteRecordFile", moved.error.code);
      return { error: "Fișierul nu a putut fi șters." };
    }

    await Promise.all([
      supabase
        .from("consultations")
        .update({ source_document_id: successor.id })
        .eq("source_document_id", document.id),
      supabase
        .from("lab_tests")
        .update({ source_document_id: successor.id })
        .eq("source_document_id", document.id),
    ]);
  }

  try {
    await trashDriveFile(familyId, document.drive_file_id);
  } catch (deleteError) {
    console.error(
      "deleteRecordFile",
      deleteError instanceof Error ? deleteError.name : "unknown",
    );
    return { error: "Fișierul nu a putut fi șters din Google Drive." };
  }

  const { error: removeError } = await supabase
    .from("medical_documents")
    .delete()
    .eq("id", document.id);
  if (removeError) {
    console.error("deleteRecordFile", removeError.code);
    return { error: "Fișierul nu a putut fi șters." };
  }

  revalidateRecord(document.profile_id);
  return {};
}

export async function replaceRecordFile(
  formData: FormData,
): Promise<DocumentActionResult> {
  const loaded = await loadDocumentFile(String(formData.get("documentId") ?? ""));
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const { supabase, document, familyId } = loaded;

  const uploaded = await readUploadedFile(formData.get("file"));
  if (!isUploadedFile(uploaded)) {
    return { error: uploaded.error };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, drive_folder_id")
    .eq("id", document.profile_id)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Profilul nu a fost găsit." };
  }

  const stored = await replacePrivateFile({
    familyId,
    profile: profile as {
      id: string;
      display_name: string;
      drive_folder_id: string | null;
    },
    filename: uploaded.filename,
    mimeType: uploaded.mimeType,
    bytes: uploaded.bytes,
    documentDate:
      document.document_date || new Date().toISOString().slice(0, 10),
    category: document.category ?? "",
  });
  if ("error" in stored) {
    return { error: stored.error };
  }

  const { error: updateError } = await supabase
    .from("medical_documents")
    .update({
      drive_file_id: stored.driveFileId,
      original_filename: uploaded.filename,
      mime_type: uploaded.mimeType,
      file_size: uploaded.size,
    })
    .eq("id", document.id);
  if (updateError) {
    console.error("replaceRecordFile", updateError.code);
    await trashDriveFile(familyId, stored.driveFileId).catch(() => undefined);
    if (
      updateError.code === "23514" &&
      (updateError.message ?? "").includes("mime_type")
    ) {
      return { error: "Aplică migrația pentru documente Word și text." };
    }
    return { error: "Fișierul nu a putut fi înlocuit." };
  }

  await trashDriveFile(familyId, document.drive_file_id).catch(() => undefined);

  revalidateRecord(document.profile_id);
  return {};
}

type ProfileFolder = {
  id: string;
  display_name: string;
  drive_folder_id: string | null;
};

async function countRecordFiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  primaryId: string,
) {
  const related = await supabase
    .from("medical_documents")
    .select("id")
    .or(`id.eq.${primaryId},record_id.eq.${primaryId}`);
  if (related.error) {
    return 1;
  }
  return (related.data ?? []).length;
}

function revalidateRecord(profileId: string, recordId?: string) {
  revalidateApp(profileId, recordId);
}

export async function addRecordFile(
  kind: RecordKind,
  id: string,
  formData: FormData,
): Promise<DocumentActionResult> {
  if (!recordKinds.includes(kind)) {
    return { error: "Înregistrarea nu este validă." };
  }
  const parsedId = profileIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { error: "Înregistrarea nu este validă." };
  }

  const uploaded = await readUploadedFile(formData.get("file"));
  if (!isUploadedFile(uploaded)) {
    return { error: uploaded.error };
  }

  const supabase = await createClient();

  if (kind === "document") {
    const loaded = await loadDocumentFile(parsedId.data);
    if ("error" in loaded) {
      return { error: loaded.error };
    }
    const { document, familyId } = loaded;
    const primaryId = document.record_id ?? document.id;
    const existing = await countRecordFiles(supabase, primaryId);
    if (existing >= MAX_RECORD_FILES) {
      return { error: `Poți avea cel mult ${MAX_RECORD_FILES} fișiere la o înregistrare.` };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, display_name, drive_folder_id")
      .eq("id", document.profile_id)
      .maybeSingle();
    if (profileError || !profile) {
      return { error: "Profilul nu a fost găsit." };
    }

    const stored = await storePrivateDocument({
      familyId,
      profile: profile as ProfileFolder,
      filename: uploaded.filename,
      mimeType: uploaded.mimeType,
      bytes: uploaded.bytes,
      size: uploaded.size,
      documentDate:
        document.document_date || new Date().toISOString().slice(0, 10),
      category: document.category ?? "",
      extractedText: "",
      title: null,
      recordId: primaryId,
    });
    if ("error" in stored) {
      return { error: stored.error };
    }

    revalidateRecord(document.profile_id, primaryId);
    return { recordId: primaryId };
  }

  const table = kind === "consultation" ? "consultations" : "lab_tests";
  const { data, error } = await supabase
    .from(table)
    .select(
      kind === "consultation"
        ? "id, profile_id, source_document_id, consultation_date, doctor_name, summary"
        : "id, profile_id, source_document_id, sample_date, test_name, result_text",
    )
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error || !data) {
    return { error: "Înregistrarea nu a fost găsită." };
  }

  const row = data as {
    id: string;
    profile_id: string;
    source_document_id: string | null;
    consultation_date?: string;
    doctor_name?: string | null;
    summary?: string | null;
    sample_date?: string | null;
    test_name?: string;
    result_text?: string | null;
  };
  const family = await requireProfileWriter(row.profile_id);
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  if (row.source_document_id) {
    return addRecordFile("document", row.source_document_id, formData);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name, drive_folder_id")
    .eq("id", row.profile_id)
    .maybeSingle();
  if (profileError || !profile) {
    return { error: "Profilul nu a fost găsit." };
  }

  const documentDate =
    (kind === "consultation" ? row.consultation_date : row.sample_date) ||
    new Date().toISOString().slice(0, 10);
  const title =
    kind === "consultation"
      ? ["Consultație", row.doctor_name].filter(Boolean).join(" · ")
      : ["Analiză", row.test_name].filter(Boolean).join(" · ");
  const stored = await storePrivateDocument({
    familyId: family.familyId,
    profile: profile as ProfileFolder,
    filename: uploaded.filename,
    mimeType: uploaded.mimeType,
    bytes: uploaded.bytes,
    size: uploaded.size,
    documentDate,
    category: kind === "consultation" ? "Consultație" : "Analize",
    extractedText: kind === "consultation" ? row.summary ?? "" : row.result_text ?? "",
    title,
    recordId: null,
  });
  if ("error" in stored) {
    return { error: stored.error };
  }

  const linked = await supabase
    .from(table)
    .update({ source_document_id: stored.documentId })
    .eq("id", row.id);
  if (linked.error) {
    console.error("addRecordFile", linked.error.code);
    return { error: "Fișierul a fost salvat, dar nu a putut fi legat de înregistrare." };
  }

  revalidateRecord(row.profile_id, stored.documentId);
  return { recordId: stored.documentId };
}
