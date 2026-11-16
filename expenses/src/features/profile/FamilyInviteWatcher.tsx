import { useEffect } from 'react';
import { useAuthState } from '@shared/context/context';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { notificationType } from '@shared/utils/constants';
import { getDataProviderKind } from '../../data';
import { acceptFamilyInvitesIfNeeded } from './acceptFamilyInvites';

/**
 * Accepts pending household invites after login and on tab focus.
 * Mount under NotificationProvider + LocalizationProvider.
 */
const FamilyInviteWatcher: React.FC = () => {
  const { token, userIsLoggedIn } = useAuthState();
  const showNotification = useNotification();
  const { t } = useLocalization();

  useEffect(() => {
    if (!token || !userIsLoggedIn || getDataProviderKind() !== 'supabase') {
      return;
    }

    let cancelled = false;

    const run = async (force: boolean) => {
      const result = await acceptFamilyInvitesIfNeeded(token, { force });
      if (cancelled || !result || result.accepted <= 0) return;
      showNotification(t('family.joined'), notificationType.SUCCESS);
    };

    void run(false);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void run(true);
      }
    };
    const onFocus = () => {
      void run(true);
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
    };
  }, [token, userIsLoggedIn, showNotification, t]);

  return null;
};

export default FamilyInviteWatcher;
