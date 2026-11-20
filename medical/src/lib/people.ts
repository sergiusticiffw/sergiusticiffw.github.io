import "server-only";

import { useFamilyCache } from "@/lib/data-cache";
import { createClient } from "@/lib/supabase/server";

export type FamilyPerson = {
  id: string;
  display_name: string;
  birth_date: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  current_medications: string | null;
  emergency_notes: string | null;
};

/**
 * People the signed-in user may see (RLS decides), with the few health fields
 * needed for the family overview and the person switcher.
 */
export async function loadFamilyPeople(
  familyId: string,
): Promise<{ people: FamilyPerson[]; error: string | null }> {
  "use cache: private";
  useFamilyCache();
  const supabase = await createClient();
  const full = await supabase
    .from("profiles")
    .select(
      "id, display_name, birth_date, blood_type, allergies, chronic_conditions, current_medications, emergency_notes",
    )
    .eq("family_id", familyId)
    .order("display_name", { ascending: true });

  if (!full.error) {
    return { people: (full.data ?? []) as FamilyPerson[], error: null };
  }

  // Databases without the emergency-card columns still get a working list.
  if (full.error.code === "42703" || full.error.code === "PGRST204") {
    const basic = await supabase
      .from("profiles")
      .select("id, display_name, birth_date")
      .eq("family_id", familyId)
      .order("display_name", { ascending: true });
    if (!basic.error) {
      return {
        people: (
          (basic.data ?? []) as Pick<
            FamilyPerson,
            "id" | "display_name" | "birth_date"
          >[]
        ).map((person) => ({
          ...person,
          blood_type: null,
          allergies: null,
          chronic_conditions: null,
          current_medications: null,
          emergency_notes: null,
        })),
        error: null,
      };
    }
    console.error("loadFamilyPeople", basic.error.code);
    return { people: [], error: "Persoanele nu au putut fi încărcate." };
  }

  console.error("loadFamilyPeople", full.error.code);
  return { people: [], error: "Persoanele nu au putut fi încărcate." };
}
