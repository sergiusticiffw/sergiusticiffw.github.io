import "server-only";

import { cacheLife, cacheTag, revalidatePath, updateTag } from "next/cache";

export const FAMILY_CACHE_TAG = "family-data";

export function profileCacheTag(profileId: string) {
  return `profile:${profileId}`;
}

export function profileDocsCardTag(profileId: string) {
  return `profile-docs-card:${profileId}`;
}

export function useFamilyCache(profileId?: string) {
  cacheLife({ stale: 60, revalidate: 60, expire: 360 });
  cacheTag(FAMILY_CACHE_TAG);
  if (profileId) {
    cacheTag(profileCacheTag(profileId));
  }
}

/** Long-lived cache for insurance + identity card metadata on a profile. */
export function useProfileDocsCardCache(profileId: string) {
  cacheLife({ stale: 2_592_000, revalidate: 2_592_000, expire: 31_536_000 });
  cacheTag(profileDocsCardTag(profileId));
}

/** Invalidates cached family catalogs and the pages that show medical data. */
export function revalidateMedicalData(profileId?: string, recordId?: string) {
  updateTag(FAMILY_CACHE_TAG);
  if (profileId) {
    updateTag(profileCacheTag(profileId));
    revalidatePath(`/profiles/${profileId}`);
  }
  revalidatePath("/profiles");
  revalidatePath("/records");
  revalidatePath("/assistant");
  if (recordId) {
    revalidatePath(`/records/${recordId}`);
  }
}

/** Family membership / invites / access grants. */
export function revalidateFamilyMembers() {
  updateTag(FAMILY_CACHE_TAG);
  revalidatePath("/family");
  revalidatePath("/profiles");
  revalidatePath("/records");
  revalidatePath("/assistant");
  revalidatePath("/profile");
}

/** Account / Drive connection only — no catalog rebuild. */
export function revalidateAccount() {
  revalidatePath("/profile");
  revalidatePath("/profiles");
  revalidatePath("/records");
  revalidatePath("/assistant");
  revalidatePath("/family");
}

/** Insurance / identity card only — not medical records or the family catalog. */
export function revalidateProfileDocsCard(profileId: string) {
  updateTag(profileDocsCardTag(profileId));
  revalidatePath(`/profiles/${profileId}`);
}

/** @deprecated Prefer revalidateMedicalData / revalidateFamilyMembers / revalidateAccount. */
export function revalidateApp(profileId?: string, recordId?: string) {
  revalidateMedicalData(profileId, recordId);
}
