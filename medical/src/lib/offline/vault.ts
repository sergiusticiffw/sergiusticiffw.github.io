/**
 * Optional, encrypted, read-only offline copy of the emergency card and the
 * titles of the latest records. Browser only.
 *
 * Storage format (also read by public/offline.html, keep both in sync):
 *   IndexedDB "dosar-offline" v1, object store "kv"
 *     "key":      { userId, key }               AES-GCM 256 CryptoKey, non-extractable
 *     "snapshot": { userId, iv, data, savedAt } data = AES-GCM(JSON snapshot)
 *
 * The key cannot be exported by scripts, and everything is deleted on logout,
 * when another account signs in, when the person turns the feature off, and
 * after MAX_AGE_MS without a refresh.
 */

export const OFFLINE_DB = "dosar-offline";
const STORE = "kv";
export const OFFLINE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const OFFLINE_REFRESH_MS = 15 * 60 * 1000;

export type OfflinePerson = {
  id: string;
  name: string;
  birthDate: string | null;
  bloodType: string | null;
  allergies: string | null;
  chronicConditions: string | null;
  currentMedications: string | null;
  emergencyNotes: string | null;
};

export type OfflineRecent = {
  id: string;
  person: string;
  title: string;
  date: string | null;
  category: string | null;
};

export type OfflineSnapshot = {
  people: OfflinePerson[];
  recent: OfflineRecent[];
};

type KeyRecord = { userId: string; key: CryptoKey };
type SnapshotRecord = {
  userId: string;
  iv: Uint8Array;
  data: ArrayBuffer;
  savedAt: number;
};

export function offlineSupported() {
  return (
    typeof indexedDB !== "undefined" &&
    typeof crypto !== "undefined" &&
    Boolean(crypto.subtle)
  );
}

function flagKey(userId: string) {
  return `dosar:offline:v1:${userId}`;
}

export function isOfflineEnabled(userId: string) {
  try {
    return localStorage.getItem(flagKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function setOfflineFlag(userId: string, enabled: boolean) {
  try {
    if (enabled) {
      localStorage.setItem(flagKey(userId), "1");
    } else {
      localStorage.removeItem(flagKey(userId));
    }
  } catch {
    // Private mode: the feature simply stays off.
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function read<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function write(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Deletes every offline byte: key, snapshot and the database itself. */
export function wipeOfflineData(): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(OFFLINE_DB);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

/** Wipes the copy and forgets the opt-in. Used on logout. */
export async function clearOfflineOnLogout(userId?: string) {
  if (userId) {
    setOfflineFlag(userId, false);
  }
  await Promise.race([
    wipeOfflineData(),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]);
}

async function keyFor(db: IDBDatabase, userId: string) {
  const stored = await read<KeyRecord>(db, "key");
  if (stored && stored.userId === userId) {
    return { db, key: stored.key };
  }
  if (stored) {
    // Another account used this browser: never reuse its key or data.
    db.close();
    await wipeOfflineData();
    const fresh = await openDb();
    return createKey(fresh, userId);
  }
  return createKey(db, userId);
}

async function createKey(db: IDBDatabase, userId: string) {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  await write(db, "key", { userId, key } satisfies KeyRecord);
  return { db, key };
}

export async function saveOfflineSnapshot(
  userId: string,
  snapshot: OfflineSnapshot,
) {
  if (!offlineSupported()) {
    return false;
  }
  const opened = await openDb();
  const { db, key } = await keyFor(opened, userId);
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(JSON.stringify(snapshot)),
    );
    await write(db, "snapshot", {
      userId,
      iv,
      data,
      savedAt: Date.now(),
    } satisfies SnapshotRecord);
    return true;
  } finally {
    db.close();
  }
}

/** When the copy was last refreshed, or null if there is none for this user. */
export async function offlineSavedAt(userId: string): Promise<number | null> {
  if (!offlineSupported()) {
    return null;
  }
  try {
    const db = await openDb();
    try {
      const stored = await read<SnapshotRecord>(db, "snapshot");
      return stored && stored.userId === userId ? stored.savedAt : null;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}
