"use server";

import { loadRecordsIndex } from "@/lib/assistant/catalog";
import { getFamilyAccess } from "@/lib/auth";
import { loadFamilyPeople } from "@/lib/people";
import type { OfflineSnapshot } from "@/lib/offline/vault";

const RECENT_LIMIT = 10;

/**
 * Data for the optional offline copy: emergency fields and the titles of the
 * latest records. No files, no IDNP, no extracted document text.
 */
export async function loadOfflineSnapshot(): Promise<
  { snapshot: OfflineSnapshot } | { error: string }
> {
  const family = await getFamilyAccess();
  if (!family.familyId) {
    return { error: family.error ?? "Familia nu a putut fi încărcată." };
  }

  const [people, index] = await Promise.all([
    loadFamilyPeople(family.familyId),
    loadRecordsIndex(family.familyId),
  ]);
  if (people.error) {
    return { error: people.error };
  }

  return {
    snapshot: {
      people: people.people.map((person) => ({
        id: person.id,
        name: person.display_name,
        birthDate: person.birth_date,
        bloodType: person.blood_type,
        allergies: person.allergies,
        chronicConditions: person.chronic_conditions,
        currentMedications: person.current_medications,
        emergencyNotes: person.emergency_notes,
      })),
      recent: index.error
        ? []
        : index.records.slice(0, RECENT_LIMIT).map((record) => ({
            id: record.id,
            person: record.profileName,
            title: record.title,
            date: record.date,
            category: record.category,
          })),
    },
  };
}
