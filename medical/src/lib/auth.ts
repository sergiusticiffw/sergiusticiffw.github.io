import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const getCurrentUser = cache(async () => {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return data.user;
});

export const getAdminFamilyId = cache(async () => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .eq("role", "admin");

  if (error) {
    console.error("getAdminFamilyId", error.code);
    return { familyId: null, error: "Familia nu a putut fi încărcată." };
  }

  const memberships = (data ?? []) as { family_id: string }[];
  if (memberships.length === 0) {
    return {
      familyId: null,
      error:
        "Contul nu este administrator al unei familii. Verifică dacă migrația a fost aplicată.",
    };
  }

  if (memberships.length > 1) {
    return {
      familyId: null,
      error:
        "Contul este administrator în mai multe familii. Versiunea actuală acceptă o singură familie.",
    };
  }

  return { familyId: memberships[0].family_id, error: null };
});
