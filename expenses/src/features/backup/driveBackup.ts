/**
 * Manual full-data backup: local JSON download + Google Drive App Data upload.
 * Each backup is a new timestamped file so Drive keeps a history list.
 */
import {
  deleteAppDataFileById,
  listAppDataFiles,
  readAppDataJsonById,
  writeAppDataJson,
  type AppDataFileMeta,
} from '../../crypto/driveVault';
import {
  BACKUP_KIND,
  type ExpensesBackupSnapshot,
} from './buildBackup';

/** Prefix shared by legacy + timestamped backup files. */
export const BACKUP_NAME_PREFIX = 'expenses-backup';

/** Keep only this many newest backups on Drive. */
export const MAX_DRIVE_BACKUPS = 5;

const LAST_BACKUP_KEY = 'expensesLastBackupAt';

export interface DriveBackupListItem {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number | null;
}

export const getLastBackupAt = (): string | null => {
  try {
    const value = localStorage.getItem(LAST_BACKUP_KEY);
    return value || null;
  } catch {
    return null;
  }
};

export const setLastBackupAt = (iso: string): void => {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, iso);
  } catch {
    /* ignore */
  }
};

/** Unique App Data filename per snapshot (never overwrite previous backups). */
export const backupFileName = (createdAt: string): string => {
  const safe = createdAt.replace(/[:.]/g, '-');
  return `${BACKUP_NAME_PREFIX}-${safe}.json`;
};

/** Trigger a browser download of the snapshot JSON. */
export const downloadBackupJson = (
  snapshot: ExpensesBackupSnapshot,
  filename?: string
): void => {
  const day = snapshot.createdAt.slice(0, 10);
  const name = filename || `expenses-backup-${day}.json`;
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const isBackupFileName = (name: string) =>
  name === `${BACKUP_NAME_PREFIX}.json` ||
  (name.startsWith(`${BACKUP_NAME_PREFIX}-`) && name.endsWith('.json'));

const toListItem = (f: AppDataFileMeta): DriveBackupListItem => ({
  id: f.id,
  name: f.name,
  createdAt: f.modifiedTime || f.createdTime || '',
  sizeBytes:
    typeof f.size === 'string' && f.size !== '' ? Number(f.size) : null,
});

/** List backup files currently stored in Drive App Data (newest first). */
export const listDriveBackups = async (options?: {
  silent?: boolean;
}): Promise<DriveBackupListItem[]> => {
  const files = await listAppDataFiles(BACKUP_NAME_PREFIX, {
    silent: options?.silent,
    pageSize: 50,
  });
  return files
    .filter((f: AppDataFileMeta) => isBackupFileName(f.name))
    .map(toListItem)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

/** Delete backups beyond the newest `MAX_DRIVE_BACKUPS`. */
export const pruneDriveBackups = async (
  keep = MAX_DRIVE_BACKUPS
): Promise<void> => {
  const all = await listDriveBackups();
  const obsolete = all.slice(Math.max(0, keep));
  await Promise.all(
    obsolete.map((item) =>
      deleteAppDataFileById(item.id).catch(() => {
        /* best-effort prune */
      })
    )
  );
};

/** Create a new timestamped backup, then keep only the newest 5 on Drive. */
export const uploadBackupToDrive = async (
  snapshot: ExpensesBackupSnapshot
): Promise<string> => {
  const name = backupFileName(snapshot.createdAt);
  await writeAppDataJson(name, snapshot);
  await pruneDriveBackups(MAX_DRIVE_BACKUPS);
  return name;
};

const isSnapshot = (raw: unknown): raw is ExpensesBackupSnapshot => {
  if (!raw || typeof raw !== 'object') return false;
  const s = raw as Partial<ExpensesBackupSnapshot>;
  return (
    (s.v === 1 || s.v === 2) &&
    s.kind === BACKUP_KIND &&
    typeof s.uid === 'string' &&
    typeof s.createdAt === 'string' &&
    Array.isArray(s.transactions) &&
    Array.isArray(s.incomes) &&
    Array.isArray(s.loans) &&
    Array.isArray(s.payments)
  );
};

/** Download one Drive backup file to the device. Returns the snapshot. */
export const downloadDriveBackupById = async (
  id: string,
  fallbackName: string
): Promise<ExpensesBackupSnapshot> => {
  const raw = await readAppDataJsonById(id);
  if (!isSnapshot(raw)) {
    throw new Error('Invalid backup file');
  }
  downloadBackupJson(raw, fallbackName);
  return raw;
};

export const formatBackupSize = (bytes: number | null): string => {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
