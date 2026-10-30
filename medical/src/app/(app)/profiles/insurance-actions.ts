"use server";

import { revalidateMedicalData } from "@/lib/data-cache";

import { requireProfileWriter } from "@/lib/auth";
import { readUploadedFile } from "@/lib/files";
import {
  discardStoredDocument,
  storePrivateDocument,
} from "@/lib/store-document";
import { createClient } from "@/lib/supabase/server";
import { profileIdSchema } from "@/lib/validation/profile";

export type InsuranceActionResult = {
  error?: string;
  saved?: boolean;
};

const INSURANCE_CATEGORY = "Asigurare";

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function ownedProfile(profileId: string) {
  const family = await requireProfileWriter(profileId);
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, drive_folder_id")
    .eq("id", profileId)
    .eq("family_id", family.familyId)
    .maybeSingle();

  if (error) {
    console.error("ownedProfile insurance", error.code);
    return { error: "Profilul nu a putut fi încărcat." };
  }
  if (!data) {
    return { error: "Profilul nu a fost găsit." };
  }

  return {
    familyId: family.familyId,
    profile: data as {
      id: string;
      display_name: string;
      drive_folder_id: string | null;
    },
  };
}

function refresh(profileId: string) {
  revalidateMedicalData(profileId);
}

function parseInsuranceFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim().slice(0, 160);
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  if (!title) {
    return { error: "Titlul este obligatoriu." };
  }
  if (!validDate(startDate) || !validDate(endDate)) {
    return { error: "Datele nu sunt valide." };
  }
  if (endDate < startDate) {
    return { error: "Data de expirare trebuie să fie după data de start." };
  }
  return { title, startDate, endDate, notes };
}

export async function createInsurance(
  formData: FormData,
): Promise<InsuranceActionResult> {
  const parsedId = profileIdSchema.safeParse(formData.get("profileId"));
  if (!parsedId.success) {
    return { error: "Profilul nu este valid." };
  }
  const fields = parseInsuranceFields(formData);
  if ("error" in fields) {
    return { error: fields.error };
  }

  const fileEntry = formData.get("file");
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return { error: "Atașează polița de asigurare (PDF sau imagine)." };
  }

  const owner = await ownedProfile(parsedId.data);
  if ("error" in owner) {
    return { error: owner.error };
  }

  const uploaded = await readUploadedFile(fileEntry);
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const stored = await storePrivateDocument({
    familyId: owner.familyId,
    profile: owner.profile,
    filename: uploaded.filename,
    mimeType: uploaded.mimeType,
    bytes: uploaded.bytes,
    size: uploaded.size,
    documentDate: fields.startDate,
    category: INSURANCE_CATEGORY,
    extractedText: fields.notes,
    title: fields.title,
  });
  if ("error" in stored) {
    return { error: stored.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("medical_insurances").insert({
    profile_id: owner.profile.id,
    title: fields.title,
    start_date: fields.startDate,
    end_date: fields.endDate,
    source_document_id: stored.documentId,
    notes: fields.notes || null,
  });
  if (error) {
    console.error("createInsurance", error.code, error.message);
    await discardStoredDocument(
      owner.familyId,
      stored.documentId,
      stored.driveFileId,
    );
    if (error.code === "42P01" || error.message?.includes("medical_insurances")) {
      return {
        error:
          "Tabela de asigurări lipsește. Rulează migrarea medical_insurances.",
      };
    }
    return { error: "Asigurarea nu a putut fi salvată." };
  }

  refresh(owner.profile.id);
  return { saved: true };
}

export async function updateInsurance(
  formData: FormData,
): Promise<InsuranceActionResult> {
  const parsedId = profileIdSchema.safeParse(formData.get("insuranceId"));
  if (!parsedId.success) {
    return { error: "Asigurarea nu este validă." };
  }
  const fields = parseInsuranceFields(formData);
  if ("error" in fields) {
    return { error: fields.error };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medical_insurances")
    .select("id, profile_id, source_document_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error || !data) {
    return { error: "Asigurarea nu a fost găsită." };
  }

  const row = data as {
    id: string;
    profile_id: string;
    source_document_id: string | null;
  };
  const owner = await ownedProfile(row.profile_id);
  if ("error" in owner) {
    return { error: owner.error };
  }

  let sourceDocumentId = row.source_document_id;
  const fileEntry = formData.get("file");
  if (fileEntry instanceof File && fileEntry.size > 0) {
    const uploaded = await readUploadedFile(fileEntry);
    if ("error" in uploaded) {
      return { error: uploaded.error };
    }
    const stored = await storePrivateDocument({
      familyId: owner.familyId,
      profile: owner.profile,
      filename: uploaded.filename,
      mimeType: uploaded.mimeType,
      bytes: uploaded.bytes,
      size: uploaded.size,
      documentDate: fields.startDate,
      category: INSURANCE_CATEGORY,
      extractedText: fields.notes,
      title: fields.title,
    });
    if ("error" in stored) {
      return { error: stored.error };
    }
    if (row.source_document_id) {
      const { data: oldDoc } = await supabase
        .from("medical_documents")
        .select("id, drive_file_id")
        .eq("id", row.source_document_id)
        .maybeSingle();
      const old = oldDoc as { id: string; drive_file_id: string } | null;
      if (old) {
        await discardStoredDocument(owner.familyId, old.id, old.drive_file_id);
      }
    }
    sourceDocumentId = stored.documentId;
  } else if (sourceDocumentId) {
    await supabase
      .from("medical_documents")
      .update({
        title: fields.title,
        document_date: fields.startDate,
        category: INSURANCE_CATEGORY,
        extracted_text: fields.notes || null,
      })
      .eq("id", sourceDocumentId);
  }

  const { error: updateError } = await supabase
    .from("medical_insurances")
    .update({
      title: fields.title,
      start_date: fields.startDate,
      end_date: fields.endDate,
      source_document_id: sourceDocumentId,
      notes: fields.notes || null,
    })
    .eq("id", row.id);
  if (updateError) {
    console.error("updateInsurance", updateError.code);
    return { error: "Asigurarea nu a putut fi modificată." };
  }

  refresh(owner.profile.id);
  return { saved: true };
}

export async function deleteInsurance(
  insuranceId: string,
): Promise<InsuranceActionResult> {
  const parsedId = profileIdSchema.safeParse(insuranceId);
  if (!parsedId.success) {
    return { error: "Asigurarea nu este validă." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medical_insurances")
    .select("id, profile_id, source_document_id")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (error || !data) {
    return { error: "Asigurarea nu a fost găsită." };
  }

  const row = data as {
    id: string;
    profile_id: string;
    source_document_id: string | null;
  };
  const owner = await ownedProfile(row.profile_id);
  if ("error" in owner) {
    return { error: owner.error };
  }

  const { error: removeError } = await supabase
    .from("medical_insurances")
    .delete()
    .eq("id", row.id);
  if (removeError) {
    console.error("deleteInsurance", removeError.code);
    return { error: "Asigurarea nu a putut fi ștearsă." };
  }

  if (row.source_document_id) {
    const { data: doc } = await supabase
      .from("medical_documents")
      .select("id, drive_file_id")
      .eq("id", row.source_document_id)
      .maybeSingle();
    const file = doc as { id: string; drive_file_id: string } | null;
    if (file) {
      await discardStoredDocument(owner.familyId, file.id, file.drive_file_id);
    }
  }

  refresh(owner.profile.id);
  return { saved: true };
}
