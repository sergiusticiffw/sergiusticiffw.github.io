import { getDataProvider, getDataProviderKind } from '../../data';
import { logger } from '@shared/utils/logger';

const INVITES_CHECKED_KEY = 'expenses.familyInvitesChecked';

/** Accept pending household invites for the signed-in email (Supabase only). */
export async function acceptFamilyInvitesIfNeeded(
  token: string
): Promise<{ accepted: number } | null> {
  if (getDataProviderKind() !== 'supabase' || !token) return null;
  try {
    if (sessionStorage.getItem(INVITES_CHECKED_KEY) === '1') {
      return { accepted: 0 };
    }
  } catch {
    // sessionStorage unavailable
  }
  try {
    const provider = getDataProvider();
    provider.configure(token);
    const result = await provider.acceptPendingInvites();
    try {
      sessionStorage.setItem(INVITES_CHECKED_KEY, '1');
    } catch {
      // ignore
    }
    if (!result.success) {
      logger.warn('acceptPendingInvites failed:', result.error);
      return null;
    }
    return { accepted: result.data?.accepted ?? 0 };
  } catch (error) {
    logger.warn('acceptPendingInvites error:', error);
    return null;
  }
}

/** Clear once-per-session gate (call on logout). */
export function resetFamilyInvitesCheck(): void {
  try {
    sessionStorage.removeItem(INVITES_CHECKED_KEY);
  } catch {
    // ignore
  }
}
