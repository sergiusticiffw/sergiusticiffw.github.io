/**
 * Build a point-in-time full-data backup snapshot for export / Drive upload.
 * Includes transactions, loans, payments, tags, Gemini key, and Goals (local + Drive).
 */
import type { DataProvider } from '../../data';
import type {
  ApiLoan,
  ExpenseAction,
  LoanAction,
  LoanPaymentsEntry,
  TransactionOrIncomeItem,
} from '@shared/type/types';
import type { TagMap, TagMode } from '../../tags/catalog';
import { sanitizeMap } from '../../tags/catalog';
import { getTagCatalog, refreshTagCatalog } from '../../tags/store';
import { getStoredApiKey } from '../../ai/storage';
import { fetchApiKeyFromServer } from '../../ai/apiKey';
import type { GoalsDriveBundle } from '../goals/driveSync';
import {
  hasDriveAccessToken,
  loadAndClaimGoalsFromDrive,
  readGoalsFromDriveSilent,
  requireGoalsOwnerKey,
} from '../goals/driveSync';
import { getEmergencyFund, replaceEmergencyFund } from '../goals/store';
import { newerEmergencyFund } from '../goals/model';
import { setGoalsEnabled, settingsStore } from '../../stores/settingsStore';
import {
  getExpensesFromDB,
  getLoansFromDB,
  getPaymentsFromDB,
  isIndexedDBAvailable,
} from '@shared/utils/indexedDB';
import { fetchExpenses } from '@features/expenses/api/expenses';
import { fetchLoans } from '@features/loans/api/loans';
import { expenseStore } from '@stores/expenseStore';
import { loanStore } from '@stores/loanStore';

export const BACKUP_KIND = 'expenses-full-backup' as const;
export const BACKUP_VERSION = 2 as const;

/** Profile settings exported alongside transactions (Drupal → Supabase). */
export interface BackupProfile {
  currency?: string;
  tag_mode?: TagMode;
  custom_tags?: TagMap;
  gemini_api_key?: string;
}

export interface ExpensesBackupSnapshot {
  v: 1 | typeof BACKUP_VERSION;
  kind: typeof BACKUP_KIND;
  uid: string;
  createdAt: string;
  transactions: TransactionOrIncomeItem[];
  incomes: TransactionOrIncomeItem[];
  loans: ApiLoan[];
  payments: LoanPaymentsEntry[];
  /** Present from v2 — tags + Gemini key (+ currency). */
  profile?: BackupProfile;
  /** Present from v2 — emergency fund / Goals (also lives on Drive). */
  goals?: GoalsDriveBundle;
}

const splitRaw = (raw: TransactionOrIncomeItem[]) => {
  const transactions: TransactionOrIncomeItem[] = [];
  const incomes: TransactionOrIncomeItem[] = [];
  for (const item of raw) {
    if (item.type === 'incomes') incomes.push(item);
    else transactions.push(item);
  }
  return { transactions, incomes };
};

const readFromStores = (): {
  raw: TransactionOrIncomeItem[];
  loans: ApiLoan[];
  payments: LoanPaymentsEntry[];
} => {
  const raw = expenseStore.state.raw ?? [];
  const loans = loanStore.state.loans ?? [];
  const payments = loanStore.state.payments ?? [];
  return { raw, loans, payments };
};

const readFromIndexedDB = async (): Promise<{
  raw: TransactionOrIncomeItem[];
  loans: ApiLoan[];
  payments: LoanPaymentsEntry[];
}> => {
  if (!isIndexedDBAvailable()) {
    return { raw: [], loans: [], payments: [] };
  }
  const [expenses, loans, payments] = await Promise.all([
    getExpensesFromDB(),
    getLoansFromDB(),
    getPaymentsFromDB(),
  ]);
  return {
    raw: (expenses as TransactionOrIncomeItem[] | null) ?? [],
    loans: (loans as ApiLoan[] | null) ?? [],
    payments: (payments as LoanPaymentsEntry[] | null) ?? [],
  };
};

const richerTags = (a: TagMap, b: TagMap): TagMap => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let aScore = 0;
  let bScore = 0;
  for (const key of keys) {
    aScore += (a[key] || []).length;
    bScore += (b[key] || []).length;
  }
  return bScore > aScore ? b : a;
};

const loadProfile = async (
  uid: string,
  apiClient?: DataProvider | null,
  accessToken?: string
): Promise<BackupProfile> => {
  // Refresh tag store from server before snapshot.
  try {
    if (accessToken && apiClient) {
      apiClient.configure(accessToken);
    }
    await refreshTagCatalog();
  } catch {
    // keep whatever is cached locally
  }

  const localCatalog = getTagCatalog();
  let tagMode: TagMode =
    localCatalog.mode === 'custom' ? 'custom' : 'default';
  let customTags = sanitizeMap(localCatalog.custom);
  let currency: string | undefined;
  let gemini = (getStoredApiKey() || '').trim();

  if (apiClient) {
    try {
      const result = await apiClient.getProfile(uid);
      if (result.success && result.data) {
        const p = result.data;
        currency = p.currency || currency;
        const serverTags = sanitizeMap(p.custom_tags);
        customTags = richerTags(customTags, serverTags);
        if (p.tag_mode === 'custom' || Object.keys(serverTags).length > 0) {
          tagMode = 'custom';
        } else if (p.tag_mode === 'default') {
          tagMode = Object.keys(customTags).length > 0 ? 'custom' : 'default';
        }
        const serverKey = (p.gemini_api_key || '').trim();
        if (serverKey) gemini = serverKey;
      }
    } catch {
      // fall through to local + explicit key fetch
    }
  }

  if (accessToken && (!gemini || gemini.length < 8)) {
    try {
      const key = (await fetchApiKeyFromServer(uid, accessToken)).trim();
      if (key) gemini = key;
    } catch {
      // keep local
    }
  }

  // If we have custom tag lists, export as custom mode so import restores them.
  if (Object.keys(customTags).length > 0) {
    tagMode = 'custom';
  }

  return {
    ...(currency ? { currency } : {}),
    tag_mode: tagMode,
    custom_tags: customTags,
    ...(gemini ? { gemini_api_key: gemini } : {}),
  };
};

const goalsAreMeaningful = (bundle: GoalsDriveBundle | null | undefined) => {
  if (!bundle?.fund) return false;
  const fund = bundle.fund;
  return (
    !!bundle.enabled ||
    (typeof fund.balance === 'number' && fund.balance > 0) ||
    (typeof fund.monthlyContribution === 'number' &&
      fund.monthlyContribution > 0) ||
    (Array.isArray(fund.contributions) && fund.contributions.length > 0)
  );
};

/** Merge local Goals with Drive (may prompt for Drive access when exporting). */
const loadGoalsForBackup = async (): Promise<GoalsDriveBundle> => {
  const localFund = getEmergencyFund();
  let enabled = !!settingsStore.state.goalsEnabled;
  let remote: GoalsDriveBundle | null = null;
  let ownerKey = '';
  try {
    ownerKey = requireGoalsOwnerKey();
  } catch {
    ownerKey = '';
  }

  if (navigator.onLine && ownerKey) {
    try {
      // Interactive: user clicked Backup — OK to request Drive if needed.
      const loaded = await loadAndClaimGoalsFromDrive(ownerKey);
      remote = loaded.bundle;
    } catch {
      try {
        if (hasDriveAccessToken()) {
          remote = await readGoalsFromDriveSilent(ownerKey);
        }
      } catch {
        remote = null;
      }
    }
  }

  const mergedFund = newerEmergencyFund(localFund, remote?.fund ?? null);
  if (remote) {
    const remoteWins =
      !localFund.updatedAt ||
      (Boolean(remote.fund.updatedAt) &&
        (remote.fund.updatedAt as string) >= (localFund.updatedAt || ''));
    if (remoteWins) enabled = remote.enabled;
  }

  // Keep local stores in sync with what we export.
  replaceEmergencyFund(mergedFund);
  setGoalsEnabled(enabled);

  return { fund: mergedFund, enabled };
};

export interface BuildBackupOptions {
  apiClient?: DataProvider | null;
  /** Auth token for profile / Gemini key fetch. */
  accessToken?: string;
  expenseDispatch?: (action: ExpenseAction) => void;
  loanDispatch?: (action: LoanAction) => void;
}

/**
 * Refresh from API when online, else use stores / IndexedDB.
 * Snapshot always reflects whatever is available at call time.
 */
export async function buildBackupSnapshot(
  uid: string,
  options: BuildBackupOptions = {}
): Promise<ExpensesBackupSnapshot> {
  const { apiClient, accessToken, expenseDispatch, loanDispatch } = options;

  if (navigator.onLine && apiClient && expenseDispatch && loanDispatch) {
    try {
      if (accessToken) apiClient.configure(accessToken);
      await Promise.all([
        fetchExpenses(apiClient, expenseDispatch),
        fetchLoans(apiClient, loanDispatch),
      ]);
    } catch {
      // Fall through to local caches below.
    }
  }

  let { raw, loans, payments } = readFromStores();
  if (raw.length === 0 && loans.length === 0 && payments.length === 0) {
    const cached = await readFromIndexedDB();
    raw = cached.raw;
    loans = cached.loans;
    payments = cached.payments;
  }

  const { transactions, incomes } = splitRaw(raw);
  const [profile, goals] = await Promise.all([
    loadProfile(String(uid), apiClient, accessToken),
    loadGoalsForBackup(),
  ]);

  // Prefer a meaningful goals payload; still include stub so importers see the key.
  const goalsOut = goalsAreMeaningful(goals)
    ? goals
    : {
        fund: getEmergencyFund(),
        enabled: !!settingsStore.state.goalsEnabled,
      };

  return {
    v: BACKUP_VERSION,
    kind: BACKUP_KIND,
    uid: String(uid),
    createdAt: new Date().toISOString(),
    transactions,
    incomes,
    loans,
    payments,
    profile,
    goals: goalsOut,
  };
}
