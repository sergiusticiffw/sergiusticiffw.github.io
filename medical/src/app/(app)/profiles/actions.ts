"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminFamilyId } from "@/lib/auth";
import { renameDriveFolder, trashDriveFile } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";
import {
  profileIdSchema,
  profileSchema,
  type ProfileInput,
} from "@/lib/validation/profile";

export type ProfileActionResult = {
  error?: string;
};

function emptyToNull(value: string) {
  return value === "" ? null : value;
}

export async function createProfile(
  input: ProfileInput,
): Promise<ProfileActionResult> {
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Verifică datele profilului." };
  }

  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").insert({
    family_id: family.familyId,
    display_name: parsed.data.displayName,
    birth_date: emptyToNull(parsed.data.birthDate),
    idnp: emptyToNull(parsed.data.idnp),
    notes: emptyToNull(parsed.data.notes),
  });

  if (error) {
    console.error("createProfile", error.code);
    if (error.code === "23505") {
      return { error: "Acest IDNP este deja folosit la alt profil." };
    }
    return { error: "Profilul nu a putut fi salvat." };
  }

  revalidatePath("/profiles");
  return {};
}

export async function updateProfile(
  id: string,
  input: ProfileInput,
): Promise<ProfileActionResult> {
  const parsedId = profileIdSchema.safeParse(id);
  const parsed = profileSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    return { error: "Verifică datele profilului." };
  }

  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("profiles")
    .select("drive_folder_id")
    .eq("id", parsedId.data)
    .eq("family_id", family.familyId)
    .maybeSingle();

  const { data, error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      birth_date: emptyToNull(parsed.data.birthDate),
      idnp: emptyToNull(parsed.data.idnp),
      notes: emptyToNull(parsed.data.notes),
    })
    .eq("id", parsedId.data)
    .eq("family_id", family.familyId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("updateProfile", error.code);
    if (error.code === "23505") {
      return { error: "Acest IDNP este deja folosit la alt profil." };
    }
    return { error: "Profilul nu a putut fi salvat." };
  }

  if (!data) {
    return { error: "Profilul nu a fost găsit." };
  }

  const folderId = (existing as { drive_folder_id: string | null } | null)
    ?.drive_folder_id;
  if (folderId) {
    try {
      await renameDriveFolder(
        family.familyId,
        folderId,
        parsed.data.displayName,
      );
    } catch (renameError) {
      console.error(
        "updateProfile",
        renameError instanceof Error ? renameError.name : "unknown",
      );
    }
  }

  revalidatePath("/profiles");
  revalidatePath(`/profiles/${parsedId.data}`);
  return {};
}

export async function deleteProfile(id: string): Promise<ProfileActionResult> {
  const parsedId = profileIdSchema.safeParse(id);
  if (!parsedId.success) {
    return { error: "Profilul nu este valid." };
  }

  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const { data: documents, error: documentsError } = await supabase
    .from("medical_documents")
    .select("drive_file_id")
    .eq("profile_id", parsedId.data);

  if (documentsError) {
    console.error("deleteProfile", documentsError.code);
    return { error: "Profilul nu a putut fi șters." };
  }

  for (const document of (documents ?? []) as { drive_file_id: string }[]) {
    try {
      await trashDriveFile(family.familyId, document.drive_file_id);
    } catch (trashError) {
      console.error(
        "deleteProfile",
        trashError instanceof Error ? trashError.name : "unknown",
      );
      return {
        error:
          "Profilul nu a fost șters. Un fișier din Google Drive nu a putut fi mutat la coș.",
      };
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", parsedId.data)
    .eq("family_id", family.familyId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("deleteProfile", error.code);
    return { error: "Profilul nu a putut fi șters." };
  }

  if (!data) {
    return { error: "Profilul nu a fost găsit." };
  }

  revalidatePath("/profiles");
  redirect("/profiles");
}
