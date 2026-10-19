"use server";

import { revalidatePath } from "next/cache";

import { getAdminFamilyId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { profileIdSchema } from "@/lib/validation/profile";

export type FamilyActionResult = {
  error?: string;
  saved?: boolean;
};

const messages: Record<string, string> = {
  invalid: "Verifică emailul și rolul.",
  forbidden: "Doar administratorul poate gestiona familia.",
  self: "Ești deja în această familie.",
  busy: "Contul are deja un dosar propriu cu date.",
  missing: "Membrul nu a fost găsit.",
  last_admin: "Familia trebuie să aibă cel puțin un administrator.",
  invited: "",
  added: "",
  updated: "",
  removed: "",
  saved: "",
};

function resultMessage(code: string | null) {
  if (!code) {
    return { error: "Acțiunea nu a putut fi salvată." };
  }
  const message = messages[code];
  if (message) {
    return { error: message };
  }
  if (message === "") {
    return { saved: true };
  }
  return { error: "Acțiunea nu a putut fi salvată." };
}

export async function inviteMember(
  _previous: FamilyActionResult,
  formData: FormData,
): Promise<FamilyActionResult> {
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invite_family_member", {
    member_email: String(formData.get("email") ?? ""),
    member_role: String(formData.get("role") ?? ""),
  });
  if (error) {
    console.error("inviteMember", error.code);
    return { error: "Invitația nu a putut fi salvată." };
  }

  revalidatePath("/family");
  return resultMessage(typeof data === "string" ? data : null);
}

export async function setMemberRole(
  _previous: FamilyActionResult,
  formData: FormData,
): Promise<FamilyActionResult> {
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_family_member_role", {
    member_id: String(formData.get("userId") ?? ""),
    member_role: String(formData.get("role") ?? ""),
  });
  if (error) {
    console.error("setMemberRole", error.code);
    return { error: "Rolul nu a putut fi schimbat." };
  }

  revalidatePath("/family");
  return resultMessage(typeof data === "string" ? data : null);
}

export async function removeMember(
  _previous: FamilyActionResult,
  formData: FormData,
): Promise<FamilyActionResult> {
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_family_member", {
    member_id: String(formData.get("userId") ?? ""),
  });
  if (error) {
    console.error("removeMember", error.code);
    return { error: "Membrul nu a putut fi scos." };
  }

  revalidatePath("/family");
  return resultMessage(typeof data === "string" ? data : null);
}

export async function cancelInvite(
  _previous: FamilyActionResult,
  formData: FormData,
): Promise<FamilyActionResult> {
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { error } = await supabase
    .from("family_invites")
    .delete()
    .eq("family_id", family.familyId)
    .eq("email", email);
  if (error) {
    console.error("cancelInvite", error.code);
    return { error: "Invitația nu a putut fi anulată." };
  }

  revalidatePath("/family");
  return { saved: true };
}

export async function renameFamily(
  _previous: FamilyActionResult,
  formData: FormData,
): Promise<FamilyActionResult> {
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 120) {
    return { error: "Numele familiei trebuie să aibă între 1 și 120 de caractere." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("families")
    .update({ name })
    .eq("id", family.familyId);
  if (error) {
    console.error("renameFamily", error.code);
    return { error: "Numele familiei nu a putut fi salvat." };
  }

  revalidatePath("/family");
  return { saved: true };
}

export async function setProfileAccess(
  _previous: FamilyActionResult,
  formData: FormData,
): Promise<FamilyActionResult> {
  const family = await getAdminFamilyId();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const profileId = String(formData.get("profileId") ?? "");
  if (!profileIdSchema.safeParse(profileId).success) {
    return { error: "Profilul nu este valid." };
  }

  const memberIds = formData
    .getAll("userId")
    .map((value) => String(value))
    .filter((value) => profileIdSchema.safeParse(value).success);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_profile_access", {
    pid: profileId,
    member_ids: memberIds,
  });
  if (error) {
    console.error("setProfileAccess", error.code);
    return {
      error: "Accesul nu a putut fi salvat. Aplică migrația pentru accesul pe profil.",
    };
  }

  revalidatePath("/family");
  revalidatePath("/profiles");
  return resultMessage(typeof data === "string" ? data : null);
}
