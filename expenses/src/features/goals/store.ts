/**
 * Emergency fund / goals preferences.
 * Local cache in localStorage; Google Drive App Data is the cross-device source.
 */
import { Store, useStore } from '@tanstack/react-store';
import { getSession } from '../../crypto/encryptionState';
import {
  EmergencyFundState,
  defaultEmergencyFund,
  normalizeEmergencyFund,
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

const initialUid = getSession()?.uid ?? '';
const emergencyFundStore = new Store<EmergencyFundState>(
  initialUid ? readStored(initialUid) : defaultEmergencyFund()
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
    uid ? readStored(uid) : defaultEmergencyFund()
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
    next = {
      ...s,
      ...partial,
      updatedAt: new Date().toISOString(),
    };
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
