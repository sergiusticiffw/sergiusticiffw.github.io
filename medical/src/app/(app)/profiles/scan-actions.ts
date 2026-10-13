"use server";

import { revalidatePath } from "next/cache";

import { getAdminFamilyId } from "@/lib/auth";
import { readUploadedFiles } from "@/lib/files";
import { extractMedicalDocument } from "@/lib/gemini";
import {
  discardStoredDocument,
  storePrivateDocument,
} from "@/lib/store-document";
import { createClient } from "@/lib/supabase/server";
import { documentSchema } from "@/lib/validation/document";
import {
  extractionSchema,
  isDocumentCategory,
  MAX_EXTRACTED_TEXT,
  type Extraction,
} from "@/lib/validation/extraction";
import { profileIdSchema } from "@/lib/validation/profile";

export type DetectResult = {
  error?: string;
  extraction?: Extraction;
  matchedProfileId?: string | null;
  matchedName?: string | null;
};

export type SaveResult = {
  error?: string;
  saved?: boolean;
  profileId?: string;
};

type Person = {
  id: string;
  display_name: string;
  drive_folder_id: string | null;
};

function geminiError(error: unknown) {
  const name = error instanceof Error ? error.message : "gemini";
  if (name === "config") {
    return "Lipsește GEMINI_API_KEY pe server.";
  }
  if (name === "quota") {
    return "Limita Gemini a fost atinsă. Încearcă mai târziu.";
  }
  if (name === "busy") {
    return "Gemini este ocupat. Încearcă din nou peste puțin timp.";
  }
  return "Documentul nu a putut fi citit. Verifică fotografia și încearcă din nou.";
}

async function profileById(familyId: string, profileId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, drive_folder_id")
    .eq("family_id", familyId)
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.error("profileById", error.code);
    return { error: "Profilul nu a putut fi căutat." };
  }

  return { profile: (data ?? null) as Person | null };
}

async function profileByIdnp(familyId: string, idnp: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, drive_folder_id")
    .eq("family_id", familyId)
    .eq("idnp", idnp)
    .maybeSingle();

  if (error) {
    console.error("profileByIdnp", error.code);
    return { error: "Profilul nu a putut fi căutat." };
  }

  return { profile: (data ?? null) as Person | null };
}

export async function detectDocument(formData: FormData): Promise<DetectResult> {
  const uploaded = await readUploadedFiles(formData.getAll("file"));
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  let extraction: Extraction;
  try {
    extraction = await extractMedicalDocument({
      files: uploaded.files.map((file) => ({
        bytes: file.bytes,
        mimeType: file.mimeType,
      })),
    });
  } catch (error) {
    console.error(
      "detectDocument",
      error instanceof Error ? error.name : "unknown",
    );
    return { error: geminiError(error) };
  }

  if (!extraction.idnp) {
    return { extraction, matchedProfileId: null, matchedName: null };
  }

  const match = await profileByIdnp(family.familyId, extraction.idnp);
  if ("error" in match && match.error) {
    return { error: match.error };
  }

  return {
    extraction,
    matchedProfileId: match.profile?.id ?? null,
    matchedName: match.profile?.display_name ?? null,
  };
}

export async function saveDetectedDocument(
  formData: FormData,
): Promise<SaveResult> {
  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { error: "Datele extrase nu sunt valide." };
  }

  const parsed = extractionSchema.safeParse(payload);
  const parsedId = profileIdSchema.safeParse(formData.get("profileId"));
  const documentDate = String(formData.get("documentDate") ?? "");
  const category = String(formData.get("category") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_EXTRACTED_TEXT);
  const lockProfile = formData.get("lockProfile") === "1";
  const savedRecord = documentSchema.safeParse({
    profileId: formData.get("profileId"),
    documentDate,
    category,
  });
  if (!parsed.success || !parsedId.success || !savedRecord.success || !body) {
    return { error: "Verifică data, categoria și textul înregistrării." };
  }
  if (!isDocumentCategory(category)) {
    return { error: "Alege categoria." };
  }

  const uploaded = await readUploadedFiles(formData.getAll("file"));
  if ("error" in uploaded) {
    return { error: uploaded.error };
  }

  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const selected = await profileById(family.familyId, parsedId.data);
  if ("error" in selected && selected.error) {
    return { error: selected.error };
  }
  if (!selected.profile) {
    return { error: "Alege persoana căreia îi aparține documentul." };
  }

  let person = selected.profile;
  if (!lockProfile && parsed.data.idnp) {
    const match = await profileByIdnp(family.familyId, parsed.data.idnp);
    if ("error" in match && match.error) {
      return { error: match.error };
    }
    if (match.profile) {
      person = match.profile;
    }
  }

  const storedFiles: { documentId: string; driveFileId: string }[] = [];
  for (const [index, file] of uploaded.files.entries()) {
    const stored = await storePrivateDocument({
      familyId: family.familyId,
      profile: person,
      filename: file.filename,
      mimeType: file.mimeType,
      bytes: file.bytes,
      size: file.size,
      documentDate,
      category,
      extractedText: index === 0 ? body : "",
      recordId: storedFiles[0]?.documentId ?? null,
    });
    if ("error" in stored) {
      if (storedFiles[0]) {
        await discardStoredDocument(
          family.familyId,
          storedFiles[0].documentId,
          storedFiles[0].driveFileId,
        );
      }
      return { error: stored.error };
    }
    storedFiles.push(stored);
  }

  revalidatePath("/profiles");
  revalidatePath(`/profiles/${person.id}`);
  revalidatePath("/records");
  return { saved: true, profileId: person.id };
}
