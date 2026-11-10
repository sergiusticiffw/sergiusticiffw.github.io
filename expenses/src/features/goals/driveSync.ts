import {
  DriveError,
  readAppDataJson,
  writeAppDataJson,
} from '../../crypto/driveVault';
import { getSession } from '../../crypto/encryptionState';
import {
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
  v: 1 | 2;
  uid: string;
  enabled?: boolean;
  balance: number;
  targetMonths: number;
  customTarget: number | null;
  monthlyContribution: number | null;
  updatedAt: string | null;
}

const toDrivePayload = (
  uid: string,
  bundle: GoalsDriveBundle
): DriveEmergencyFundFile => ({
  v: 2,
  uid: String(uid),
  enabled: bundle.enabled,
  balance: bundle.fund.balance,
  targetMonths: bundle.fund.targetMonths,
  customTarget: bundle.fund.customTarget,
  monthlyContribution: bundle.fund.monthlyContribution,
  updatedAt: bundle.fund.updatedAt,
});

const fromDriveFile = (
  file: Partial<DriveEmergencyFundFile>
): GoalsDriveBundle => ({
  fund: normalizeEmergencyFund(file),
  enabled: typeof file.enabled === 'boolean' ? file.enabled : false,
});

/** Pull Goals bundle from Google Drive App Data, or null if none. */
export const readGoalsFromDrive = async (
  uid: string
): Promise<GoalsDriveBundle | null> => {
  const raw = await readAppDataJson(EMERGENCY_FUND_DRIVE_FILE);
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
    bundle.fund.customTarget == null &&
    bundle.fund.monthlyContribution == null &&
    !bundle.enabled
  ) {
    return null;
  }
  return bundle;
};

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
