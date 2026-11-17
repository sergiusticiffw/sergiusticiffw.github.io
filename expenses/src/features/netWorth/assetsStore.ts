import { useSyncExternalStore } from 'react';
import { getSession } from '../../crypto/encryptionState';
import {
  NetWorthAsset,
  NetWorthAssetKind,
  NetWorthAssetsState,
  createNetWorthAsset,
  emptyNetWorthAssets,
  sanitizeNetWorthAssets,
} from './model';

const STORAGE_PREFIX = 'netWorthAssets:';
const LEGACY_CASH_PREFIX = 'netWorthCash:';

type Listener = () => void;

const storageOwnerKey = (): string => {
  const session = getSession();
  const email = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (email.includes('@')) return email;
  return session?.uid ? String(session.uid) : '';
};

const storageKey = (owner: string) => `${STORAGE_PREFIX}${owner}`;
const legacyCashKey = (owner: string) => `${LEGACY_CASH_PREFIX}${owner}`;

let activeOwner = storageOwnerKey();
let cached: NetWorthAssetsState = emptyNetWorthAssets();
let hydrated = false;
const listeners = new Set<Listener>();

const readLegacyCash = (owner: string): number => {
  try {
    const raw = localStorage.getItem(legacyCashKey(owner));
    if (raw == null) return 0;
    const value = Number(JSON.parse(raw));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

const readStorage = (owner: string): NetWorthAssetsState => {
  if (!owner) return emptyNetWorthAssets();
  try {
    const raw = localStorage.getItem(storageKey(owner));
    if (raw) return sanitizeNetWorthAssets(JSON.parse(raw));
    const legacyCash = readLegacyCash(owner);
    if (legacyCash) {
      return {
        ...emptyNetWorthAssets(),
        cash: legacyCash,
        updatedAt: new Date().toISOString(),
      };
    }
    return emptyNetWorthAssets();
  } catch {
    return emptyNetWorthAssets();
  }
};

const emit = () => {
  listeners.forEach((listener) => listener());
};

const ensureOwner = () => {
  const owner = storageOwnerKey();
  if (owner !== activeOwner) {
    activeOwner = owner;
    cached = owner ? readStorage(owner) : emptyNetWorthAssets();
    hydrated = !!owner;
    emit();
  }
  return owner;
};

const ensureHydrated = () => {
  const owner = ensureOwner();
  if (hydrated) return;
  cached = readStorage(owner);
  hydrated = true;
};

const writeState = (next: NetWorthAssetsState, syncRemote = true) => {
  const owner = ensureOwner();
  cached = {
    ...sanitizeNetWorthAssets(next),
    updatedAt: new Date().toISOString(),
  };
  if (owner) {
    try {
      localStorage.setItem(storageKey(owner), JSON.stringify(cached));
      // Keep legacy cash key in sync for older readers / mid-migration.
      localStorage.setItem(legacyCashKey(owner), JSON.stringify(cached.cash));
    } catch {
      // ignore
    }
  }
  emit();
  if (syncRemote) {
    void import('../profile/preferencesSync')
      .then((m) =>
        m.schedulePreferencesPush({
          netWorthCash: cached.cash,
          netWorthAssets: cached as unknown as Record<string, unknown>,
        })
      )
      .catch(() => undefined);
  }
};

export const getNetWorthAssets = (): NetWorthAssetsState => {
  ensureHydrated();
  return cached;
};

/** @deprecated Prefer getNetWorthAssets().cash */
export const getNetWorthCash = (): number => getNetWorthAssets().cash;

export const setNetWorthCash = (value: number): number => {
  ensureHydrated();
  writeState({ ...cached, cash: value }, true);
  return cached.cash;
};

export const replaceNetWorthAssets = (
  next: NetWorthAssetsState | unknown,
  options?: { syncRemote?: boolean }
): NetWorthAssetsState => {
  ensureHydrated();
  writeState(sanitizeNetWorthAssets(next), options?.syncRemote !== false);
  return cached;
};

export const hydrateNetWorthAssetsFromPrefs = (value: unknown): void => {
  if (value == null) return;
  ensureHydrated();
  writeState(sanitizeNetWorthAssets(value), false);
};

/** Apply remote cash-only prefs without pushing back. */
export const hydrateNetWorthCashFromPrefs = (value: unknown): void => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  ensureHydrated();
  writeState({ ...cached, cash: value }, false);
};

export const addNetWorthAsset = (input: {
  name: string;
  value: number;
  kind?: NetWorthAssetKind;
}): NetWorthAsset | null => {
  ensureHydrated();
  const item = createNetWorthAsset(input);
  if (!item) return null;
  writeState({ ...cached, items: [item, ...cached.items] }, true);
  return item;
};

export const updateNetWorthAsset = (
  id: string,
  patch: Partial<Pick<NetWorthAsset, 'name' | 'value' | 'kind'>>
): NetWorthAsset | null => {
  ensureHydrated();
  let updated: NetWorthAsset | null = null;
  const items = cached.items.map((item) => {
    if (item.id !== id) return item;
    const next = createNetWorthAsset({
      name: patch.name ?? item.name,
      value: patch.value ?? item.value,
      kind: patch.kind ?? item.kind,
    });
    if (!next) return item;
    updated = { ...next, id: item.id };
    return updated;
  });
  if (!updated) return null;
  writeState({ ...cached, items }, true);
  return updated;
};

export const removeNetWorthAsset = (id: string): void => {
  ensureHydrated();
  writeState(
    { ...cached, items: cached.items.filter((item) => item.id !== id) },
    true
  );
};

export const subscribeNetWorthAssets = (listener: Listener) => {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useNetWorthAssets(): NetWorthAssetsState {
  return useSyncExternalStore(
    subscribeNetWorthAssets,
    getNetWorthAssets,
    emptyNetWorthAssets
  );
}

export function useNetWorthCash(): number {
  return useNetWorthAssets().cash;
}
