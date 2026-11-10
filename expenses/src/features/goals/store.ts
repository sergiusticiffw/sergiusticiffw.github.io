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

const storageKey = (uid: string) => `${STORAGE_PREFIX}${uid}`;

const readStored = (uid: string): EmergencyFundState => {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return defaultEmergencyFund();
    return normalizeEmergencyFund(JSON.parse(raw));
  } catch {
    return defaultEmergencyFund();
  }
};

const writeStored = (uid: string, state: EmergencyFundState) => {
  localStorage.setItem(storageKey(uid), JSON.stringify(state));
};

/** Load and rewrite if normalize changed balance (e.g. doubled ledger). */
const loadAndReconcile = (uid: string): EmergencyFundState => {
  const next = readStored(uid);
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return next;
    const parsed = JSON.parse(raw) as { balance?: number };
    if (
      typeof parsed.balance === 'number' &&
      parsed.balance !== next.balance
    ) {
      writeStored(uid, next);
    }
  } catch {
    // ignore rewrite failures
  }
  return next;
};

const initialUid = getSession()?.uid ?? '';
const emergencyFundStore = new Store<EmergencyFundState>(
  initialUid ? loadAndReconcile(initialUid) : defaultEmergencyFund()
);

let activeUid = initialUid;

const persist = (state: EmergencyFundState) => {
  const uid = getSession()?.uid ?? activeUid;
  if (!uid) return;
  activeUid = uid;
  writeStored(uid, state);
};

/** Reload from localStorage for the signed-in user (call after login). */
export function hydrateEmergencyFund(): void {
  const uid = getSession()?.uid ?? '';
  activeUid = uid;
  emergencyFundStore.setState(() =>
    uid ? loadAndReconcile(uid) : defaultEmergencyFund()
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
  if (activeUid) writeStored(activeUid, next);
}

export { emergencyFundStore };
