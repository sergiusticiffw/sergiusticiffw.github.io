/**
 * Emergency fund / goals preferences.
 * Local cache in localStorage; Google Drive App Data is the cross-device source.
 */
import { Store, useStore } from '@tanstack/react-store';
import { getSession } from '../../crypto/encryptionState';
import {
  EmergencyFundState,
  applyContribution,
  defaultEmergencyFund,
  normalizeEmergencyFund,
  removeContribution,
  updateContribution,
} from './model';

const STORAGE_PREFIX = 'emergencyFund:';

/** Prefer email so Classic ↔ New share the same local Goals cache. */
const storageOwnerKey = (): string => {
  const session = getSession();
  const email = String(session?.email || '')
    .trim()
    .toLowerCase();
  if (email.includes('@')) return email;
  return session?.uid ? String(session.uid) : '';
};

const storageKey = (owner: string) => `${STORAGE_PREFIX}${owner}`;

const readStored = (owner: string): EmergencyFundState => {
  try {
    const raw = localStorage.getItem(storageKey(owner));
    if (!raw) {
      // Migrate legacy uid-keyed cache into email key once.
      const uid = getSession()?.uid;
      if (uid && owner !== String(uid)) {
        const legacy = localStorage.getItem(storageKey(String(uid)));
        if (legacy) {
          localStorage.setItem(storageKey(owner), legacy);
          return normalizeEmergencyFund(JSON.parse(legacy));
        }
      }
      return defaultEmergencyFund();
    }
    return normalizeEmergencyFund(JSON.parse(raw));
  } catch {
    return defaultEmergencyFund();
  }
};

const writeStored = (owner: string, state: EmergencyFundState) => {
  localStorage.setItem(storageKey(owner), JSON.stringify(state));
};

/** Load and rewrite if normalize changed balance (e.g. doubled ledger). */
const loadAndReconcile = (owner: string): EmergencyFundState => {
  const next = readStored(owner);
  try {
    const raw = localStorage.getItem(storageKey(owner));
    if (!raw) return next;
    const parsed = JSON.parse(raw) as { balance?: number };
    if (
      typeof parsed.balance === 'number' &&
      parsed.balance !== next.balance
    ) {
      writeStored(owner, next);
    }
  } catch {
    // ignore rewrite failures
  }
  return next;
};

const initialOwner = storageOwnerKey();
const emergencyFundStore = new Store<EmergencyFundState>(
  initialOwner ? loadAndReconcile(initialOwner) : defaultEmergencyFund()
);

let activeOwner = initialOwner;

const persist = (state: EmergencyFundState) => {
  const owner = storageOwnerKey() || activeOwner;
  if (!owner) return;
  activeOwner = owner;
  writeStored(owner, state);
};

/** Reload from localStorage for the signed-in user (call after login). */
export function hydrateEmergencyFund(): void {
  const owner = storageOwnerKey();
  activeOwner = owner;
  emergencyFundStore.setState(() =>
    owner ? loadAndReconcile(owner) : defaultEmergencyFund()
  );
}

export function useEmergencyFund(): EmergencyFundState {
  return useStore(emergencyFundStore, (s) => s);
}

export function getEmergencyFund(): EmergencyFundState {
  return emergencyFundStore.state;
}

export function setEmergencyFund(partial: Partial<EmergencyFundState>): EmergencyFundState {
  let next = defaultEmergencyFund();
  emergencyFundStore.setState((s) => {
    next = normalizeEmergencyFund({
      ...s,
      ...partial,
      updatedAt: new Date().toISOString(),
    });
    persist(next);
    return next;
  });
  return next;
}

/** Add a monthly saving to the ledger and bump balance. */
export function addEmergencyFundContribution(
  amount: number,
  month: string
): EmergencyFundState {
  let next = defaultEmergencyFund();
  emergencyFundStore.setState((s) => {
    next = applyContribution(s, amount, month);
    persist(next);
    return next;
  });
  return next;
}

/** Edit a ledger entry (amount/month) and adjust balance. */
export function updateEmergencyFundContribution(
  id: string,
  patch: { amount: number; month: string }
): EmergencyFundState | null {
  let next: EmergencyFundState | null = null;
  emergencyFundStore.setState((s) => {
    next = updateContribution(s, id, patch);
    if (!next) return s;
    persist(next);
    return next;
  });
  return next;
}

/** Delete a ledger entry and reduce balance. */
export function removeEmergencyFundContribution(
  id: string
): EmergencyFundState | null {
  let next: EmergencyFundState | null = null;
  emergencyFundStore.setState((s) => {
    next = removeContribution(s, id);
    if (!next) return s;
    persist(next);
    return next;
  });
  return next;
}

/** Replace full state (e.g. after Drive pull). Keeps provided updatedAt. */
export function replaceEmergencyFund(state: EmergencyFundState): void {
  const next = normalizeEmergencyFund(state);
  emergencyFundStore.setState(() => next);
  persist(next);
}

export function resetEmergencyFund(): void {
  const next = defaultEmergencyFund();
  emergencyFundStore.setState(() => next);
  if (activeOwner) writeStored(activeOwner, next);
}

export { emergencyFundStore };
