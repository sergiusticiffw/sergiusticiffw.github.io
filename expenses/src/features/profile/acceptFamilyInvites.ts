import { getDataProvider, getDataProviderKind } from '../../data';
import { logger } from '@shared/utils/logger';

/** Accept pending household invites for the signed-in email (Supabase only). */
export async function acceptFamilyInvitesIfNeeded(
  token: string
): Promise<{ accepted: number } | null> {
  if (getDataProviderKind() !== 'supabase' || !token) return null;
  try {
    const provider = getDataProvider();
    provider.configure(token);
    const result = await provider.acceptPendingInvites();
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
