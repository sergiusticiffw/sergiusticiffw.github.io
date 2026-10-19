"use server";

import { revalidatePath } from "next/cache";

import { requireProfileWriter } from "@/lib/auth";
import { trashDriveFile } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";
import { profileIdSchema } from "@/lib/validation/profile";

export type DocumentActionResult = {
  error?: string;
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

  revalidatePath("/profiles");
  revalidatePath(`/profiles/${row.profile_id}`);
  revalidatePath("/assistant");
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

  revalidatePath("/profiles");
  revalidatePath(`/profiles/${row.profile_id}`);
  revalidatePath("/assistant");
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

  revalidatePath("/profiles");
  revalidatePath(`/profiles/${document.profile_id}`);
  revalidatePath("/assistant");
  return {};
}
