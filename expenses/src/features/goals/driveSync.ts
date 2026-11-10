import {
  DriveError,
  hasDriveAccessToken,
  readAppDataJson,
  writeAppDataJson,
} from '../../crypto/driveVault';
import { getSession } from '../../crypto/encryptionState';
import {
  Contribution,
  EmergencyFundState,
  normalizeEmergencyFund,
} from './model';

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

const parseGoalsFile = (
  uid: string,
  raw: unknown
): GoalsDriveBundle | null => {
  if (!raw || typeof raw !== 'object') return null;
  const file = raw as Partial<DriveEmergencyFundFile>;
  if (file.uid != null && String(file.uid) !== String(uid)) {
    throw new DriveError(
      'The emergency fund in this Google Drive belongs to a different account.'
    );
  }
  const bundle = fromDriveFile(file);
  // Treat never-saved empty remote as missing.
  if (
    !bundle.fund.updatedAt &&
    bundle.fund.balance <= 0 &&
    bundle.fund.monthlyContribution == null &&
    bundle.fund.contributions.length === 0 &&
    !bundle.enabled
  ) {
    return null;
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
  bundle: GoalsDriveBundle
): Promise<void> => {
  await writeAppDataJson(EMERGENCY_FUND_DRIVE_FILE, toDrivePayload(uid, bundle));
};

/** Save fund fields; keeps / sets enabled on the Drive file. */
export const saveEmergencyFundToDrive = async (
  uid: string,
  state: EmergencyFundState,
  enabled = false
): Promise<void> => {
  await saveGoalsToDrive(uid, { fund: state, enabled });
};

export const requireSessionUid = (): string => {
  const session = getSession();
  if (!session?.uid) throw new DriveError('Not signed in');
  return session.uid;
};
