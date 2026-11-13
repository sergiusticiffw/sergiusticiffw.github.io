/**
 * Import an expenses-full-backup JSON into the signed-in Supabase account.
 * All rows upsert by stable id (Drupal nid → deterministic UUID) so re-import
 * updates instead of duplicating.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../data/providers/supabase/client';
import { getDataProviderKind, getDataProvider } from '../../data';
import {
  BACKUP_KIND,
  type ExpensesBackupSnapshot,
} from './buildBackup';
import {
  applyGoalsBackupBundle,
  requireGoalsOwnerKey,
} from '../goals/driveSync';
import { setStoredApiKey } from '../../ai/storage';
import {
  applyImportedTagCatalog,
  refreshTagCatalog,
} from '../../tags/store';
import { sanitizeMap, type TagCatalog, type TagMap } from '../../tags/catalog';
import { setSettingsCurrency } from '../../stores/settingsStore';
import { stableRowId } from '../../data/providers/supabase/stableId';

const BATCH = 200;

export type ImportBackupProgress = {
  phase:
    | 'auth'
    | 'profile'
    | 'transactions'
    | 'loans'
    | 'payments'
    | 'goals'
    | 'done';
  done: number;
  total: number;
  label?: string;
};

export type ImportBackupResult = {
  transactions: number;
  loans: number;
  payments: number;
  paymentsSkipped: number;
  profile: boolean;
  goals: boolean;
};

export class ImportBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportBackupError';
  }
}

const asText = (value: unknown) =>
  value === undefined || value === null ? '' : String(value);

const toIso = (value: unknown): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n >= 1e12 ? n : n * 1000;
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const fingerprint = (...parts: unknown[]) =>
  parts.map((p) => asText(p).trim().toLowerCase()).join('|');

/** Last row wins when the same stable id appears twice in one backup. */
const dedupeById = (
  rows: Record<string, unknown>[]
): Record<string, unknown>[] => {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const id = String(row.id || '');
    if (!id) continue;
    map.set(id, row);
  }
  return [...map.values()];
};

const mergeTagMaps = (a: TagMap, b: TagMap): TagMap => {
  const out: TagMap = { ...a };
  for (const [key, tags] of Object.entries(b)) {
    const existing = out[key] || [];
    const merged = [...existing];
    for (const tag of tags || []) {
      if (!merged.includes(tag)) merged.push(tag);
    }
    out[key] = merged;
  }
  return out;
};

export const parseBackupJson = (raw: unknown): ExpensesBackupSnapshot => {
  if (!raw || typeof raw !== 'object') {
    throw new ImportBackupError('Invalid JSON');
  }
  const s = raw as Partial<ExpensesBackupSnapshot>;
  if (s.kind !== BACKUP_KIND || (s.v !== 1 && s.v !== 2)) {
    throw new ImportBackupError(
      'Not an expenses backup file (expected expenses-full-backup v1/v2)'
    );
  }
  if (
    !Array.isArray(s.transactions) ||
    !Array.isArray(s.incomes) ||
    !Array.isArray(s.loans) ||
    !Array.isArray(s.payments)
  ) {
    throw new ImportBackupError('Backup file is missing required arrays');
  }
  return s as ExpensesBackupSnapshot;
};

export const readBackupFile = (file: File): Promise<ExpensesBackupSnapshot> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        resolve(parseBackupJson(JSON.parse(text)));
      } catch (error) {
        reject(
          error instanceof ImportBackupError
            ? error
            : new ImportBackupError(
                error instanceof Error ? error.message : 'Could not read file'
              )
        );
      }
    };
    reader.onerror = () =>
      reject(new ImportBackupError('Could not read the selected file'));
    reader.readAsText(file);
  });

const ensureSession = async (
  accessToken: string,
  refreshToken?: string
): Promise<{ supabase: SupabaseClient; userId: string }> => {
  const supabase = getSupabaseClient();
  const { data: existing } = await supabase.auth.getSession();
  if (
    accessToken &&
    (!existing.session || existing.session.access_token !== accessToken)
  ) {
    if (refreshToken) {
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } else {
      await supabase.auth.refreshSession().catch(() => undefined);
    }
  }
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id || '';
  if (!userId) {
    throw new ImportBackupError('Not signed in to Supabase');
  }
  return { supabase, userId };
};

const upsertBatches = async (
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onProgress: (done: number, total: number) => void
) => {
  if (!rows.length) {
    onProgress(0, 0);
    return;
  }
  let done = 0;
  for (const batch of chunk(rows, BATCH)) {
    const { error } = await supabase.from(table).upsert(batch, {
      onConflict: 'id',
      ignoreDuplicates: false,
    });
    if (error) {
      throw new ImportBackupError(
        `${table} upsert failed (${done}/${rows.length}): ${error.message}`
      );
    }
    done += batch.length;
    onProgress(done, rows.length);
  }
};

export type ImportBackupOptions = {
  accessToken: string;
  refreshToken?: string;
  onProgress?: (p: ImportBackupProgress) => void;
};

/**
 * Import a backup snapshot into the current Supabase user.
 * Upserts transactions, incomes, loans, payments, profile/tags, Gemini, Goals.
 */
export async function importBackupToSupabase(
  backup: ExpensesBackupSnapshot,
  options: ImportBackupOptions
): Promise<ImportBackupResult> {
  if (getDataProviderKind() !== 'supabase') {
    throw new ImportBackupError('Import is only available with the Supabase provider');
  }
  if (!navigator.onLine) {
    throw new ImportBackupError('Import requires an internet connection');
  }

  const report = (partial: ImportBackupProgress) =>
    options.onProgress?.(partial);

  report({ phase: 'auth', done: 0, total: 1 });
  const { supabase, userId } = await ensureSession(
    options.accessToken,
    options.refreshToken
  );
  report({ phase: 'auth', done: 1, total: 1 });

  // --- profile (tags / gemini / currency) — upsert + merge tags ---
  report({ phase: 'profile', done: 0, total: 1 });
  const profile =
    backup.profile && typeof backup.profile === 'object' ? backup.profile : {};
  const tagMode: TagCatalog['mode'] =
    profile.tag_mode === 'custom' ? 'custom' : 'default';
  let customTags = sanitizeMap(profile.custom_tags);
  const gemini =
    typeof profile.gemini_api_key === 'string'
      ? profile.gemini_api_key.trim()
      : '';
  const currency =
    typeof profile.currency === 'string' && profile.currency.trim()
      ? profile.currency.trim()
      : undefined;

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('tag_mode, custom_tags, gemini_api_key, currency')
    .eq('id', userId)
    .maybeSingle();

  if (existingProfile?.custom_tags) {
    customTags = mergeTagMaps(
      sanitizeMap(existingProfile.custom_tags),
      customTags
    );
  }

  const hasTags =
    tagMode === 'custom' ||
    Object.keys(customTags).length > 0 ||
    existingProfile?.tag_mode === 'custom';

  const profileRow: Record<string, unknown> = {
    id: userId,
    updated_at: new Date().toISOString(),
    ...(currency ? { currency } : {}),
    ...(hasTags
      ? {
          tag_mode:
            tagMode === 'custom' || Object.keys(customTags).length > 0
              ? 'custom'
              : 'default',
          custom_tags: customTags,
        }
      : {}),
    ...(gemini ? { gemini_api_key: gemini } : {}),
  };

  const { data: savedProfile, error: profileError } = await supabase
    .from('profiles')
    .upsert(profileRow, { onConflict: 'id' })
    .select('id, tag_mode, custom_tags, gemini_api_key, currency')
    .single();
  if (profileError) {
    throw new ImportBackupError(`Profile update failed: ${profileError.message}`);
  }

  if (hasTags) {
    const catalog: TagCatalog = {
      mode:
        savedProfile?.tag_mode === 'custom' || tagMode === 'custom'
          ? 'custom'
          : 'default',
      custom: sanitizeMap(savedProfile?.custom_tags ?? customTags),
    };
    applyImportedTagCatalog(userId, catalog);
  }
  if (currency) setSettingsCurrency(currency);
  if (gemini) setStoredApiKey(gemini);

  try {
    const provider = getDataProvider();
    provider.configure(options.accessToken);
    await refreshTagCatalog();
  } catch {
    // Local apply above already succeeded.
  }
  report({ phase: 'profile', done: 1, total: 1 });

  // --- transactions + incomes (upsert by stable id) ---
  const txSource = [...(backup.transactions || []), ...(backup.incomes || [])];
  const txRows: Record<string, unknown>[] = [];
  for (const row of txSource) {
    const type = row.type === 'incomes' ? 'incomes' : 'transaction';
    const created = toIso(row.cr);
    const updated = toIso((row as { upd?: unknown }).upd) || created;
    const sourceKey =
      asText(row.id) ||
      fingerprint(type, row.dt, row.sum, row.dsc, row.cat, row.cr);
    if (!sourceKey) continue;
    const id = await stableRowId(userId, 'tx', sourceKey);
    txRows.push({
      id,
      user_id: userId,
      type,
      amount: asText(row.sum),
      date: asText(row.dt),
      description: asText(row.dsc),
      category: type === 'transaction' ? asText(row.cat) || null : null,
      encrypted_payload:
        (row as { encrypted_payload?: string; payload?: string })
          .encrypted_payload ||
        (row as { payload?: string }).payload ||
        null,
      ...(created ? { created_at: created } : {}),
      ...(updated ? { updated_at: updated } : {}),
    });
  }
  const txDeduped = dedupeById(txRows);
  report({
    phase: 'transactions',
    done: 0,
    total: txDeduped.length,
    label: String(txDeduped.length),
  });
  await upsertBatches(supabase, 'transactions', txDeduped, (done, total) =>
    report({ phase: 'transactions', done, total })
  );

  // --- loans ---
  const loanIdMap = new Map<string, string>();
  const loanRows: Record<string, unknown>[] = [];
  for (const row of backup.loans || []) {
    const sourceKey =
      asText(row.id) || fingerprint(row.title, row.sdt, row.fp, row.cr);
    if (!sourceKey) continue;
    const id = await stableRowId(userId, 'loan', sourceKey);
    if (row.id != null && String(row.id) !== '') {
      loanIdMap.set(String(row.id), id);
    }
    loanIdMap.set(id, id);
    const created = toIso(row.cr);
    const updated = toIso((row as { upd?: unknown }).upd) || created;
    loanRows.push({
      id,
      user_id: userId,
      title: asText(row.title),
      fp: asText(row.fp),
      sdt: asText(row.sdt),
      edt: asText(row.edt),
      fr: asText(row.fr),
      fpm: asText(row.fpm),
      fif: asText(row.fif),
      pdt: asText(row.pdt),
      frpd: asText(row.frpd),
      fls: asText(row.fls),
      encrypted_payload:
        (row as { encrypted_payload?: string; payload?: string })
          .encrypted_payload ||
        (row as { payload?: string }).payload ||
        null,
      ...(created ? { created_at: created } : {}),
      ...(updated ? { updated_at: updated } : {}),
    });
  }
  const loanDeduped = dedupeById(loanRows);
  report({ phase: 'loans', done: 0, total: loanDeduped.length });
  await upsertBatches(supabase, 'loans', loanDeduped, (done, total) =>
    report({ phase: 'loans', done, total })
  );

  // --- payments ---
  const paymentRows: Record<string, unknown>[] = [];
  let paymentsSkipped = 0;
  for (const group of backup.payments || []) {
    const loanKey = String(group.loanId ?? '');
    let newLoanId = loanIdMap.get(loanKey);
    if (!newLoanId && loanKey) {
      newLoanId = await stableRowId(userId, 'loan', loanKey);
      loanIdMap.set(loanKey, newLoanId);
    }
    if (!newLoanId) {
      paymentsSkipped += (group.data || []).length;
      continue;
    }
    for (const row of group.data || []) {
      const created = toIso(row.cr);
      const updated = toIso((row as { upd?: unknown }).upd) || created;
      const sourceKey =
        asText(row.id) ||
        fingerprint(group.loanId, row.fdt, row.title, row.fpi, row.fr, row.cr);
      if (!sourceKey) continue;
      const id = await stableRowId(userId, 'pay', sourceKey);
      paymentRows.push({
        id,
        user_id: userId,
        loan_id: newLoanId,
        title: asText(row.title),
        fdt: asText(row.fdt),
        fr: asText(row.fr),
        fpi: asText(row.fpi),
        fpsf: asText(row.fpsf),
        fnra: asText(row.fnra),
        fnp: asText(row.fnp),
        fpm: asText(row.fpm),
        fisp: asText(row.fisp || '0'),
        encrypted_payload:
          (row as { encrypted_payload?: string; payload?: string })
            .encrypted_payload ||
          (row as { payload?: string }).payload ||
          null,
        ...(created ? { created_at: created } : {}),
        ...(updated ? { updated_at: updated } : {}),
      });
    }
  }
  const paymentDeduped = dedupeById(paymentRows);
  report({ phase: 'payments', done: 0, total: paymentDeduped.length });
  await upsertBatches(supabase, 'payments', paymentDeduped, (done, total) =>
    report({ phase: 'payments', done, total })
  );

  // --- goals ---
  let goalsApplied = false;
  report({ phase: 'goals', done: 0, total: 1 });
  const goalsFund = backup.goals?.fund;
  const goalsMeaningful =
    !!goalsFund &&
    (!!backup.goals?.enabled ||
      (typeof goalsFund.balance === 'number' && goalsFund.balance > 0) ||
      (typeof goalsFund.monthlyContribution === 'number' &&
        goalsFund.monthlyContribution > 0) ||
      (Array.isArray(goalsFund.contributions) &&
        goalsFund.contributions.length > 0));
  if (goalsMeaningful && goalsFund) {
    let goalsOwner = userId;
    try {
      goalsOwner = requireGoalsOwnerKey();
    } catch {
      goalsOwner = userId;
    }
    await applyGoalsBackupBundle(
      goalsOwner,
      {
        fund: goalsFund,
        enabled: !!backup.goals?.enabled,
      },
      { writeDrive: true }
    );
    goalsApplied = true;
  }
  report({ phase: 'goals', done: 1, total: 1 });
  report({ phase: 'done', done: 1, total: 1 });

  return {
    transactions: txDeduped.length,
    loans: loanDeduped.length,
    payments: paymentDeduped.length,
    paymentsSkipped,
    profile: true,
    goals: goalsApplied,
  };
}
