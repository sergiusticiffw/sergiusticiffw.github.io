import { loadOfflineSnapshot } from "@/app/(app)/offline-actions";
import {
  isOfflineEnabled,
  OFFLINE_REFRESH_MS,
  offlineSavedAt,
  offlineSupported,
  saveOfflineSnapshot,
  wipeOfflineData,
} from "@/lib/offline/vault";

/** Downloads the current emergency data and stores it encrypted. */
export async function refreshOfflineCopy(
  userId: string,
): Promise<{ savedAt: number } | { error: string }> {
  if (!offlineSupported()) {
    return { error: "Acest browser nu permite salvarea offline." };
  }
  try {
    const result = await loadOfflineSnapshot();
    if ("error" in result) {
      return { error: result.error };
    }
    const saved = await saveOfflineSnapshot(userId, result.snapshot);
    if (!saved) {
      return { error: "Copia offline nu a putut fi salvată." };
    }
    return { savedAt: Date.now() };
  } catch {
    return { error: "Copia offline nu a putut fi salvată. Încearcă din nou." };
  }
}

/** Keeps the copy fresh when the person opted in, and removes it when not. */
export async function syncOfflineCopy(userId: string) {
  if (!offlineSupported()) {
    return;
  }
  if (!isOfflineEnabled(userId)) {
    await wipeOfflineData();
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return;
  }
  const savedAt = await offlineSavedAt(userId);
  if (savedAt && Date.now() - savedAt < OFFLINE_REFRESH_MS) {
    return;
  }
  await refreshOfflineCopy(userId);
}
