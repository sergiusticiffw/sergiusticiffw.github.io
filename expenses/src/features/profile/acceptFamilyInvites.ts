import { getDataProvider, getDataProviderKind } from '../../data';
import { logger } from '@shared/utils/logger';
import { clearFamilySharedTotalsCache } from '../expenses/components/Charts/useFamilySharedTotals';

const INVITES_CHECKED_KEY = 'expenses.familyInvitesChecked';
const INVITES_CHECKED_AT_KEY = 'expenses.familyInvitesCheckedAt';
/** Re-check pending invites at most this often when forced / on focus. */
const RECHECK_COOLDOWN_MS = 15_000;

const readCheckedAt = (): number => {
  try {
    const raw = sessionStorage.getItem(INVITES_CHECKED_AT_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
};

const markChecked = (): void => {
  try {
    sessionStorage.setItem(INVITES_CHECKED_KEY, '1');
    sessionStorage.setItem(INVITES_CHECKED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
};

/** Accept pending household invites for the signed-in email (Supabase only). */
export async function acceptFamilyInvitesIfNeeded(
  token: string,
  options: { force?: boolean } = {}
): Promise<{ accepted: number } | null> {
  if (getDataProviderKind() !== 'supabase' || !token) return null;

  const force = !!options.force;
  try {
    if (!force && sessionStorage.getItem(INVITES_CHECKED_KEY) === '1') {
      return { accepted: 0 };
    }
    if (force && Date.now() - readCheckedAt() < RECHECK_COOLDOWN_MS) {
      return { accepted: 0 };
    }
  } catch {
    // sessionStorage unavailable
  }

  try {
    const provider = getDataProvider();
    provider.configure(token);
    const result = await provider.acceptPendingInvites();
    markChecked();
    if (!result.success) {
      logger.warn('acceptPendingInvites failed:', result.error);
      return null;
    }
    const accepted = result.data?.accepted ?? 0;
    if (accepted > 0) {
      clearFamilySharedTotalsCache();
    }
    return { accepted };
  } catch (error) {
    logger.warn('acceptPendingInvites error:', error);
    return null;
  }
}

/** Clear once-per-session gate (call on logout). */
export function resetFamilyInvitesCheck(): void {
  try {
    sessionStorage.removeItem(INVITES_CHECKED_KEY);
    sessionStorage.removeItem(INVITES_CHECKED_AT_KEY);
  } catch {
    // ignore
  }
}
