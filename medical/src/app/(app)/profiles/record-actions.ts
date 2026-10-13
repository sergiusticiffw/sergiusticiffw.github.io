"use server";

import { revalidatePath } from "next/cache";

import { getAdminFamilyId } from "@/lib/auth";
import { readUploadedFiles } from "@/lib/files";
import {
  discardStoredDocument,
  storePrivateDocument,
} from "@/lib/store-document";
import { createClient } from "@/lib/supabase/server";
import {
  consultationDraftSchema,
  emptyConsultation,
  labDraftSchema,
  recordBody,
  splitReference,
  splitResult,
  type LabDraft,
} from "@/lib/validation/extraction";
import { profileIdSchema } from "@/lib/validation/profile";

export type RecordActionResult = {
  error?: string;
  saved?: boolean;
};

async function ownedProfile(profileId: string) {
  const family = await getAdminFamilyId();
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
    console.error("ownedProfile", error.code);
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
  revalidatePath("/profiles");
  revalidatePath(`/profiles/${profileId}`);
  revalidatePath("/records");
}

function isMissingColumn(code: string | undefined) {
  return code === "42703" || code === "PGRST204";
}

async function storeRecordFiles(input: {
  familyId: string;
  profile: {
    id: string;
    display_name: string;
    drive_folder_id: string | null;
  };
  entries: FormDataEntryValue[];
  documentDate: string;
  category: string;
  body: string;
}): Promise<{ error: string } | { documentId: string | null; driveFileId: string | null }> {
  const present = input.entries.filter(
    (entry): entry is File => entry instanceof File && entry.size > 0,
  );
  if (present.length === 0) {
    return { documentId: null, driveFileId: null };
  }

  const uploaded = await readUploadedFiles(present);
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const storedFiles: { documentId: string; driveFileId: string }[] = [];
  for (const [index, file] of uploaded.files.entries()) {
    const stored = await storePrivateDocument({
      familyId: input.familyId,
      profile: input.profile,
      filename: file.filename,
      mimeType: file.mimeType,
      bytes: file.bytes,
      size: file.size,
      documentDate: input.documentDate,
      category: input.category,
      extractedText: index === 0 ? input.body : "",
      recordId: storedFiles[0]?.documentId ?? null,
    });
    if ("error" in stored) {
      if (storedFiles[0]) {
        await discardStoredDocument(
          input.familyId,
          storedFiles[0].documentId,
          storedFiles[0].driveFileId,
        );
      }
      return { error: stored.error };
    }
    storedFiles.push(stored);
  }

  return {
    documentId: storedFiles[0]?.documentId ?? null,
    driveFileId: storedFiles[0]?.driveFileId ?? null,
  };
}

export async function createConsultation(
  _previous: RecordActionResult,
  formData: FormData,
): Promise<RecordActionResult> {
  const parsedId = profileIdSchema.safeParse(formData.get("profileId"));
  const parsed = consultationDraftSchema.safeParse({
    doctorName: formData.get("doctorName") ?? "",
    clinicName: formData.get("clinicName") ?? "",
    specialty: formData.get("specialty") ?? "",
    consultationDate: formData.get("consultationDate") ?? "",
    summary: formData.get("summary") ?? "",
    recommendations: formData.get("recommendations") ?? "",
  });
  if (!parsedId.success || !parsed.success) {
    return { error: "Verifică datele consultației." };
  }
  if (!parsed.data.consultationDate) {
    return { error: "Data consultației este obligatorie." };
  }

  const owner = await ownedProfile(parsedId.data);
  if ("error" in owner) {
    return { error: owner.error };
  }

  const body = recordBody({
    idnp: "",
    extractedText: "",
    consultation: parsed.data,
    labTests: [],
  });
  const files = await storeRecordFiles({
    familyId: owner.familyId,
    profile: owner.profile,
    entries: formData.getAll("file"),
    documentDate: parsed.data.consultationDate,
    category: "Consultație",
    body,
  });
  if ("error" in files) {
    return { error: files.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("consultations").insert({
    profile_id: owner.profile.id,
    ...(files.documentId ? { source_document_id: files.documentId } : {}),
    doctor_name: parsed.data.doctorName || null,
    clinic_name: parsed.data.clinicName || null,
    specialty: parsed.data.specialty || null,
    consultation_date: parsed.data.consultationDate,
    summary: parsed.data.summary || null,
    recommendations: parsed.data.recommendations || null,
  });
  if (error) {
    console.error("createConsultation", error.code);
    if (files.documentId && files.driveFileId && isMissingColumn(error.code)) {
      refresh(owner.profile.id);
      return { saved: true };
    }
    if (files.documentId && files.driveFileId) {
      await discardStoredDocument(owner.familyId, files.documentId, files.driveFileId);
    }
    return { error: "Consultația nu a putut fi salvată." };
  }

  refresh(owner.profile.id);
  return { saved: true };
}

export async function createLabTest(
  _previous: RecordActionResult,
  formData: FormData,
): Promise<RecordActionResult> {
  const parsedId = profileIdSchema.safeParse(formData.get("profileId"));
  const parsed = labDraftSchema.safeParse({
    testName: formData.get("testName") ?? "",
    category: formData.get("category") ?? "",
    sampleDate: formData.get("sampleDate") ?? "",
    result: formData.get("result") ?? "",
    unit: formData.get("unit") ?? "",
    reference: formData.get("reference") ?? "",
    laboratory: formData.get("laboratory") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsedId.success || !parsed.success || !parsed.data.testName) {
    return { error: "Numele analizei este obligatoriu." };
  }

  const owner = await ownedProfile(parsedId.data);
  if ("error" in owner) {
    return { error: owner.error };
  }

  const hasFiles = formData
    .getAll("file")
    .some((entry) => entry instanceof File && entry.size > 0);
  if (hasFiles && !parsed.data.sampleDate) {
    return { error: "Data recoltării este necesară când atașezi fișiere." };
  }

  const labRow: LabDraft = parsed.data;
  const body = recordBody({
    idnp: "",
    extractedText: "",
    consultation: emptyConsultation(),
    labTests: [labRow],
  });
  const files = await storeRecordFiles({
    familyId: owner.familyId,
    profile: owner.profile,
    entries: formData.getAll("file"),
    documentDate: parsed.data.sampleDate,
    category: "Analize",
    body,
  });
  if ("error" in files) {
    return { error: files.error };
  }

  const result = splitResult(parsed.data.result);
  const reference = splitReference(parsed.data.reference);
  const supabase = await createClient();
  const { error } = await supabase.from("lab_tests").insert({
    profile_id: owner.profile.id,
    ...(files.documentId ? { source_document_id: files.documentId } : {}),
    test_name: parsed.data.testName,
    category: parsed.data.category || null,
    sample_date: parsed.data.sampleDate || null,
    result_value: result.resultValue,
    result_text: result.resultText,
    unit: parsed.data.unit || null,
    reference_min: reference.referenceMin,
    reference_max: reference.referenceMax,
    reference_text: reference.referenceText,
    laboratory: parsed.data.laboratory || null,
    notes: parsed.data.notes || null,
  });
  if (error) {
    console.error("createLabTest", error.code);
    if (files.documentId && files.driveFileId && isMissingColumn(error.code)) {
      refresh(owner.profile.id);
      return { saved: true };
    }
    if (files.documentId && files.driveFileId) {
      await discardStoredDocument(owner.familyId, files.documentId, files.driveFileId);
    }
    return { error: "Analiza nu a putut fi salvată." };
  }

  refresh(owner.profile.id);
  return { saved: true };
}
