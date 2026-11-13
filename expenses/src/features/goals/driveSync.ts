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
  normalizeEmergencyFund,
} from './model';
import { replaceEmergencyFund } from './store';

export const EMERGENCY_FUND_DRIVE_FILE = 'emergency-fund.json';

/** Full Goals package stored in Drive (fund fields + feature toggle). */
export interface GoalsDriveBundle {
  fund: EmergencyFundState;
  enabled: boolean;
}

interface DriveEmergencyFundFile {
  v: 1 | 2 | 3;
  uid: string;
  enabled?: boolean;
  balance: number;
  targetMonths: number;
  monthlyContribution: number | null;
  contributions?: Contribution[];
  updatedAt: string | null;
}

/** Drive file exists but was written under a different account uid (e.g. Drupal → Supabase). */
export class GoalsDriveUidMismatchError extends DriveError {
  foreignUid: string;
  bundle: GoalsDriveBundle;

  constructor(foreignUid: string, bundle: GoalsDriveBundle) {
    super(
      'The emergency fund in this Google Drive belongs to a different account.'
    );
    this.name = 'GoalsDriveUidMismatchError';
    this.foreignUid = foreignUid;
    this.bundle = bundle;
  }
}

const toDrivePayload = (
  uid: string,
  bundle: GoalsDriveBundle
): DriveEmergencyFundFile => ({
  v: 3,
  uid: String(uid),
  enabled: bundle.enabled,
  balance: bundle.fund.balance,
  targetMonths: bundle.fund.targetMonths,
  monthlyContribution: bundle.fund.monthlyContribution,
  contributions: bundle.fund.contributions,
  updatedAt: bundle.fund.updatedAt,
});

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

const parseGoalsFile = (
  uid: string,
  raw: unknown,
  options?: { allowForeignUid?: boolean }
): GoalsDriveBundle | null => {
  if (!raw || typeof raw !== 'object') return null;
  const file = raw as Partial<DriveEmergencyFundFile>;
  const bundle = fromDriveFile(file);
  if (isEmptyBundle(bundle)) return null;

  if (file.uid != null && String(file.uid) !== String(uid)) {
    if (options?.allowForeignUid) {
      return bundle;
    }
    throw new GoalsDriveUidMismatchError(String(file.uid), bundle);
  }
  return bundle;
};

/** Pull Goals bundle from Google Drive App Data, or null if none. */
export const readGoalsFromDrive = async (
  uid: string
): Promise<GoalsDriveBundle | null> => {
  const raw = await readAppDataJson(EMERGENCY_FUND_DRIVE_FILE);
  return parseGoalsFile(uid, raw);
};

/**
 * Same as readGoalsFromDrive but never opens a Google login popup.
 * Returns null when there is no session Drive token yet.
 */
export const readGoalsFromDriveSilent = async (
  uid: string
): Promise<GoalsDriveBundle | null> => {
  if (!hasDriveAccessToken()) return null;
  const raw = await readAppDataJson(EMERGENCY_FUND_DRIVE_FILE, {
    silent: true,
  });
  return parseGoalsFile(uid, raw);
};

export type GoalsDriveLoadResult = {
  bundle: GoalsDriveBundle | null;
  /** True when file belonged to another uid and was rewritten for this user. */
  claimed: boolean;
};

/**
 * Load Goals from Drive. If the file belongs to a previous account uid
 * (Drupal → Supabase), claim it for the current uid and rewrite the file.
 */
export const loadAndClaimGoalsFromDrive = async (
  uid: string,
  options?: { silent?: boolean }
): Promise<GoalsDriveLoadResult> => {
  const silent = !!options?.silent;
  if (silent && !hasDriveAccessToken()) {
    return { bundle: null, claimed: false };
  }

  const raw = await readAppDataJson(EMERGENCY_FUND_DRIVE_FILE, { silent });
  if (!raw) return { bundle: null, claimed: false };

  try {
    return { bundle: parseGoalsFile(uid, raw), claimed: false };
  } catch (error) {
    if (!(error instanceof GoalsDriveUidMismatchError)) throw error;
    // Adopt the orphaned Drupal-era file for the current Supabase uid.
    await saveGoalsToDrive(uid, error.bundle, { silent });
    return { bundle: error.bundle, claimed: true };
  }
};

export { hasDriveAccessToken };

/** @deprecated use readGoalsFromDrive */
export const readEmergencyFundFromDrive = async (
  uid: string
): Promise<EmergencyFundState | null> => {
  const bundle = await readGoalsFromDrive(uid);
  return bundle?.fund ?? null;
};

/** Save full Goals package into Google Drive App Data. */
export const saveGoalsToDrive = async (
  uid: string,
  bundle: GoalsDriveBundle,
  options?: { silent?: boolean }
): Promise<void> => {
  await writeAppDataJson(
    EMERGENCY_FUND_DRIVE_FILE,
    toDrivePayload(uid, bundle),
    options
  );
};

/** Save fund fields; keeps / sets enabled on the Drive file. */
export const saveEmergencyFundToDrive = async (
  uid: string,
  state: EmergencyFundState,
  enabled = false
): Promise<void> => {
  await saveGoalsToDrive(uid, { fund: state, enabled });
};

/** Apply a Goals bundle from a backup JSON (local + optional Drive rewrite). */
export const applyGoalsBackupBundle = async (
  uid: string,
  bundle: GoalsDriveBundle,
  options?: { writeDrive?: boolean }
): Promise<void> => {
  replaceEmergencyFund(bundle.fund);
  setGoalsEnabled(!!bundle.enabled);
  if (options?.writeDrive !== false && navigator.onLine) {
    try {
      await saveGoalsToDrive(uid, bundle);
    } catch {
      // Local apply still succeeded.
    }
  }
};

export const requireSessionUid = (): string => {
  const session = getSession();
  if (!session?.uid) throw new DriveError('Not signed in');
  return session.uid;
};
