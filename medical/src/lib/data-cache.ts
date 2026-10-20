import "server-only";

import { cacheLife, cacheTag, revalidatePath, updateTag } from "next/cache";

export const FAMILY_CACHE_TAG = "family-data";

export function useFamilyCache() {
  cacheLife({ stale: 60, revalidate: 60, expire: 360 });
  cacheTag(FAMILY_CACHE_TAG);
}

export function revalidateApp(profileId?: string, recordId?: string) {
  updateTag(FAMILY_CACHE_TAG);
  revalidatePath("/profiles");
  revalidatePath("/profile");
  revalidatePath("/records");
  revalidatePath("/assistant");
  revalidatePath("/family");
  if (profileId) {
    revalidatePath(`/profiles/${profileId}`);
  }
  if (recordId) {
    revalidatePath(`/records/${recordId}`);
  }
}
