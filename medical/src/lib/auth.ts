import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const claimed = await supabase.auth.getClaims();
  const claims = claimed.data?.claims;
  const claimedId = typeof claims?.sub === "string" ? claims.sub : "";
  if (claimedId) {
    return {
      id: claimedId,
      email: typeof claims?.email === "string" ? claims.email : "",
    };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login");
  }

  return { id: data.user.id, email: data.user.email ?? "" };
});

export async function getPageUser() {
  await connection();
  return getCurrentUser();
}

export type FamilyRole = "admin" | "editor" | "viewer";

const FAMILY_ROLES: FamilyRole[] = ["admin", "editor", "viewer"];

export function canWrite(role: FamilyRole | null) {
  return role === "admin" || role === "editor";
}

export const getFamilyAccess = cache(async () => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id, role")
    .eq("user_id", user.id);

  if (error) {
    console.error("getFamilyAccess", error.code);
    return { familyId: null, role: null, error: "Familia nu a putut fi încărcată." };
  }

  const memberships = (data ?? []) as { family_id: string; role: string }[];
  if (memberships.length === 0) {
    return {
      familyId: null,
      role: null,
      error: "Contul nu aparține unei familii. Verifică dacă migrația a fost aplicată.",
    };
  }
  if (memberships.length > 1) {
    return {
      familyId: null,
      role: null,
      error: "Contul este în mai multe familii. Versiunea actuală acceptă o singură familie.",
    };
  }

  const role = memberships[0].role;
  if (!FAMILY_ROLES.includes(role as FamilyRole)) {
    return { familyId: null, role: null, error: "Rolul din familie nu este valid." };
  }

  return {
    familyId: memberships[0].family_id,
    role: role as FamilyRole,
    error: null,
  };
});

export async function getPageFamilyAccess() {
  await connection();
  return getFamilyAccess();
}

export const getAdminFamilyId = cache(async () => {
  const access = await getFamilyAccess();
  if (!access.familyId || access.role !== "admin") {
    return {
      familyId: null,
      error: access.familyId
        ? "Doar administratorul familiei poate face asta."
        : access.error,
    };
  }

  return { familyId: access.familyId, error: null };
});

export async function requireWriter() {
  const access = await getFamilyAccess();
  if (!access.familyId || !canWrite(access.role)) {
    return {
      familyId: null,
      error: access.familyId
        ? "Nu ai dreptul să modifici dosarul."
        : access.error,
    };
  }

  return { familyId: access.familyId, error: null };
}

export async function requireProfileWriter(profileId: string) {
  const access = await getFamilyAccess();
  if (!access.familyId || !access.role) {
    return {
      familyId: null,
      error: access.error ?? "Familia nu a putut fi încărcată.",
    };
  }
  if (access.role === "admin") {
    return { familyId: access.familyId, error: null };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_access")
    .select("profile_id")
    .eq("profile_id", profileId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("requireProfileWriter", error.code);
    return { familyId: null, error: "Profilul nu a putut fi verificat." };
  }
  if (!data) {
    return {
      familyId: null,
      error: "Nu ai dreptul să modifici înregistrările acestui profil.",
    };
  }

  return { familyId: access.familyId, error: null };
}
