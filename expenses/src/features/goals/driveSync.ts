import {
  DriveError,
  hasDriveAccessToken,
  readAppDataJson,
  writeAppDataJson,
} from '../../crypto/driveVault';
import { getSession } from '../../crypto/encryptionState';
import { setGoalsEnabled } from '../../stores/settingsStore';
import {
  Contribution,
  EmergencyFundState,
  newerEmergencyFund,
  normalizeEmergencyFund,
} from './model';
import { getEmergencyFund, replaceEmergencyFund } from './store';

export const EMERGENCY_FUND_DRIVE_FILE = 'emergency-fund.json';

/** Full Goals package stored in Drive (fund fields + feature toggle). */
export interface GoalsDriveBundle {
  fund: EmergencyFundState;
  enabled: boolean;
}

interface DriveEmergencyFundFile {
  /** v4+ uses email as the stable owner key (Drupal ↔ Supabase). */
  v: 1 | 2 | 3 | 4;
  /** @deprecated legacy owner — numeric Drupal / UUID Supabase */
  uid?: string;
  /** Preferred owner key — Google email, unique across backends. */
  email?: string;
  enabled?: boolean;
  balance: number;
  targetMonths: number;
  monthlyContribution: number | null;
  contributions?: Contribution[];
  updatedAt: string | null;
}

/** Drive file owner does not match the signed-in Google email. */
export class GoalsDriveUidMismatchError extends DriveError {
  foreignUid: string;
  bundle: GoalsDriveBundle;

  constructor(foreignOwner: string, bundle: GoalsDriveBundle) {
    super(
      'The emergency fund in this Google Drive belongs to a different account.'
    );
    this.name = 'GoalsDriveUidMismatchError';
    this.foreignUid = foreignOwner;
    this.bundle = bundle;
  }
}

const normalizeEmail = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const isEmail = (value: string) => value.includes('@') && value.includes('.');

/**
 * Stable Drive Goals owner: Google email when available, else uid (legacy).
 */
export const requireGoalsOwnerKey = (): string => {
  const session = getSession();
  if (!session?.uid) throw new DriveError('Not signed in');
  const email = normalizeEmail(session.email);
  if (email && isEmail(email)) return email;
  return String(session.uid);
};

/** Account uid (Drupal nid / Supabase UUID) — not for Drive Goals ownership. */
export const requireSessionUid = (): string => {
  const session = getSession();
  if (!session?.uid) throw new DriveError('Not signed in');
  return session.uid;
};

const toDrivePayload = (
  ownerKey: string,
  bundle: GoalsDriveBundle
): DriveEmergencyFundFile => {
  const session = getSession();
  const email = isEmail(ownerKey) ? ownerKey : normalizeEmail(session?.email);
  return {
    v: 4,
    email: email && isEmail(email) ? email : undefined,
    // Keep uid as secondary hint for debugging / older readers.
    uid: session?.uid ? String(session.uid) : undefined,
    enabled: bundle.enabled,
    balance: bundle.fund.balance,
    targetMonths: bundle.fund.targetMonths,
    monthlyContribution: bundle.fund.monthlyContribution,
    contributions: bundle.fund.contributions,
    updatedAt: bundle.fund.updatedAt,
  };
};

const fromDriveFile = (
  file: Partial<DriveEmergencyFundFile>
): GoalsDriveBundle => ({
  fund: normalizeEmergencyFund(file),
  enabled: typeof file.enabled === 'boolean' ? file.enabled : false,
});

const isEmptyBundle = (bundle: GoalsDriveBundle) =>
  !bundle.fund.updatedAt &&
  bundle.fund.balance <= 0 &&
  bundle.fund.monthlyContribution == null &&
  bundle.fund.contributions.length === 0 &&
  !bundle.enabled;

/**
 * Ownership:
 * - Match on email when the file has email (v4).
 * - Legacy uid-only files → treat as claimable (same Google Drive App Data).
 * - Email present but different → hard mismatch.
 */
const parseGoalsFile = (
  ownerKey: string,
  raw: unknown
): { bundle: GoalsDriveBundle; needsClaim: boolean } | null => {
  if (!raw || typeof raw !== 'object') return null;
  const file = raw as Partial<DriveEmergencyFundFile>;
  const bundle = fromDriveFile(file);
  if (isEmptyBundle(bundle)) return null;

  const fileEmail = normalizeEmail(file.email);
  const ownerEmail = isEmail(ownerKey) ? ownerKey : '';

  if (fileEmail && isEmail(fileEmail)) {
    if (ownerEmail && fileEmail === ownerEmail) {
      return { bundle, needsClaim: false };
    }
    if (ownerEmail && fileEmail !== ownerEmail) {
      throw new GoalsDriveUidMismatchError(fileEmail, bundle);
    }
    // Session has no email yet — accept and rewrite when we can.
    return { bundle, needsClaim: true };
  }

  // Legacy uid-only (or empty owner): claim onto email for this Google account.
  return { bundle, needsClaim: true };
};

/** Save full Goals package into Google Drive App Data (keyed by email). */
export const saveGoalsToDrive = async (
  ownerKey: string,
  bundle: GoalsDriveBundle,
  options?: { silent?: boolean }
): Promise<void> => {
  await writeAppDataJson(
    EMERGENCY_FUND_DRIVE_FILE,
    toDrivePayload(ownerKey, bundle),
    options
  );
};

/** Pull Goals bundle from Google Drive App Data, or null if none. */
export const readGoalsFromDrive = async (
  ownerKey: string
): Promise<GoalsDriveBundle | null> => {
  const raw = await readAppDataJson(EMERGENCY_FUND_DRIVE_FILE);
  const parsed = parseGoalsFile(ownerKey, raw);
  if (!parsed) return null;
  if (parsed.needsClaim) {
    await saveGoalsToDrive(ownerKey, parsed.bundle);
  }
  return parsed.bundle;
};

/**
 * Same as readGoalsFromDrive but never opens a Google login popup.
 * Returns null when there is no session Drive token yet.
 */
export const readGoalsFromDriveSilent = async (
  ownerKey: string
): Promise<GoalsDriveBundle | null> => {
  if (!hasDriveAccessToken()) return null;
  const raw = await readAppDataJson(EMERGENCY_FUND_DRIVE_FILE, {
    silent: true,
  });
  const parsed = parseGoalsFile(ownerKey, raw);
  if (!parsed) return null;
  if (parsed.needsClaim) {
    try {
      await saveGoalsToDrive(ownerKey, parsed.bundle, { silent: true });
    } catch {
      // Still return data; interactive sync will stamp email.
    }
  }
  return parsed.bundle;
};

export type GoalsDriveLoadResult = {
  bundle: GoalsDriveBundle | null;
  /** True when file was rewritten to the current email owner. */
  claimed: boolean;
};

/**
 * Load Goals from Drive. Migrates legacy uid-owned files to email ownership.
 */
export const loadAndClaimGoalsFromDrive = async (
  ownerKey: string,
  options?: { silent?: boolean }
): Promise<GoalsDriveLoadResult> => {
  const silent = !!options?.silent;
  if (silent && !hasDriveAccessToken()) {
    return { bundle: null, claimed: false };
  }

  const raw = await readAppDataJson(EMERGENCY_FUND_DRIVE_FILE, { silent });
  if (!raw) return { bundle: null, claimed: false };

  try {
    const parsed = parseGoalsFile(ownerKey, raw);
    if (!parsed) return { bundle: null, claimed: false };
    if (!parsed.needsClaim) {
      return { bundle: parsed.bundle, claimed: false };
    }
    try {
      await saveGoalsToDrive(ownerKey, parsed.bundle, { silent });
      return { bundle: parsed.bundle, claimed: true };
    } catch {
      return { bundle: parsed.bundle, claimed: false };
    }
  } catch (error) {
    if (!(error instanceof GoalsDriveUidMismatchError)) throw error;
    // Different email stamped on file — still surface data; rewrite to ours
    // only when this is the same Google Drive App Data (always is).
    try {
      await saveGoalsToDrive(ownerKey, error.bundle, { silent });
      return { bundle: error.bundle, claimed: true };
    } catch {
      return { bundle: error.bundle, claimed: false };
    }
  }
};

/**
 * Silent merge of Drive Goals into local store (login / boot).
 * No Google popup. Returns true when a remote bundle was applied.
 */
export const hydrateGoalsFromDriveSilent = async (): Promise<boolean> => {
  if (!navigator.onLine || !hasDriveAccessToken()) return false;
  let ownerKey: string;
  try {
    ownerKey = requireGoalsOwnerKey();
  } catch {
    return false;
  }

  try {
    const { bundle } = await loadAndClaimGoalsFromDrive(ownerKey, {
      silent: true,
    });
    if (!bundle) return false;

    const localFund = getEmergencyFund();
    const merged = newerEmergencyFund(localFund, bundle.fund);
    replaceEmergencyFund(merged);

    const remoteWins =
      !localFund.updatedAt ||
      (Boolean(bundle.fund.updatedAt) &&
        (bundle.fund.updatedAt as string) >= (localFund.updatedAt || ''));
    if (remoteWins) {
      setGoalsEnabled(!!bundle.enabled);
    }
    return true;
  } catch {
    return false;
  }
};

export { hasDriveAccessToken };

/** @deprecated use readGoalsFromDrive */
export const readEmergencyFundFromDrive = async (
  ownerKey: string
): Promise<EmergencyFundState | null> => {
  const bundle = await readGoalsFromDrive(ownerKey);
  return bundle?.fund ?? null;
};

/** Save fund fields; keeps / sets enabled on the Drive file. */
export const saveEmergencyFundToDrive = async (
  ownerKey: string,
  state: EmergencyFundState,
  enabled = false
): Promise<void> => {
  await saveGoalsToDrive(ownerKey, { fund: state, enabled });
};

/** Apply a Goals bundle from a backup JSON (local + Supabase prefs, never Drive). */
export const applyGoalsBackupBundle = async (
  _ownerKey: string,
  bundle: GoalsDriveBundle,
  options?: { writeDrive?: boolean; writeSupabase?: boolean }
): Promise<void> => {
  replaceEmergencyFund(bundle.fund);
  setGoalsEnabled(!!bundle.enabled);
  const writeCloud = options?.writeSupabase !== false && options?.writeDrive !== false;
  if (writeCloud && navigator.onLine) {
    try {
      const { persistGoalsToSupabase } = await import(
        '../profile/preferencesSync'
      );
      await persistGoalsToSupabase({
        fund: bundle.fund,
        enabled: !!bundle.enabled,
      });
    } catch {
      // Local apply still succeeded.
    }
  }
};
