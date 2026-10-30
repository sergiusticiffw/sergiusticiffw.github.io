"use server";

import { getAdminFamilyId, getCurrentUser } from "@/lib/auth";
import { revalidateAccount } from "@/lib/data-cache";
import { disconnectDrive } from "@/lib/google-drive";
import { createClient } from "@/lib/supabase/server";
import {
  newPasswordSchema,
  type NewPasswordInput,
} from "@/lib/validation/auth";

export type ProfileActionResult = {
  error?: string;
  message?: string;
};

export async function changeAccountPassword(
  input: NewPasswordInput,
): Promise<ProfileActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Verifică parola nouă." };
  }

  await getCurrentUser();
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error("changeAccountPassword", error.code);
    return { error: "Parola nu a putut fi schimbată." };
  }

  return { message: "Parola a fost actualizată." };
}

export async function disconnectGoogleDrive(): Promise<ProfileActionResult> {
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Doar administratorul poate deconecta Drive." };
  }

  try {
    await disconnectDrive(family.familyId);
  } catch (error) {
    console.error(
      "disconnectGoogleDrive",
      error instanceof Error ? error.name : "unknown",
    );
    return {
      error:
        error instanceof Error
          ? error.message
          : "Google Drive nu a putut fi deconectat.",
    };
  }

  revalidateAccount();
  return { message: "Google Drive a fost deconectat." };
}
