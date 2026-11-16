import { useEffect, useRef } from 'react';
import { useAuthState } from '@shared/context/context';
import { useLocalization } from '@shared/context/localization';
import { useNotification } from '@shared/context/notification';
import { notificationType } from '@shared/utils/constants';
import { getDataProvider, getDataProviderKind } from '../../data';

const SEEN_KEY = 'expenses.familyActivitySeenAt';

/**
 * Polls household activity and toasts new events (invite accepted, role changes, etc.).
 */
const FamilyActivityWatcher: React.FC = () => {
  const { token, userIsLoggedIn, userDetails } = useAuthState();
  const showNotification = useNotification();
  const { t } = useLocalization();
  const myUid = String(userDetails?.current_user?.uid || '');
  const seenRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      seenRef.current = sessionStorage.getItem(SEEN_KEY);
    } catch {
      seenRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!token || !userIsLoggedIn || getDataProviderKind() !== 'supabase') {
      return;
    }

    let cancelled = false;

    const labelFor = (eventType: string) => {
      const key = `family.activity.${eventType}`;
      const translated = t(key);
      return translated === key ? t('family.activity.unknown') : translated;
    };

    const poll = async () => {
      try {
        const provider = getDataProvider();
        provider.configure(token);
        const result = await provider.listHouseholdActivity();
        if (cancelled || !result.success || !result.data?.length) return;

        const newest = result.data[0];
        const newestAt = newest.created_at;
        const previous = seenRef.current;

        if (!previous) {
          seenRef.current = newestAt;
          try {
            sessionStorage.setItem(SEEN_KEY, newestAt);
          } catch {
            // ignore
          }
          return;
        }

        if (newestAt <= previous) return;

        const fresh = result.data.filter(
          (item) =>
            item.created_at > previous &&
            (!item.actor_id || item.actor_id !== myUid)
        );

        seenRef.current = newestAt;
        try {
          sessionStorage.setItem(SEEN_KEY, newestAt);
        } catch {
          // ignore
        }

        for (const item of fresh.slice(0, 3)) {
          showNotification(
            labelFor(String(item.event_type)),
            notificationType.SUCCESS
          );
        }
      } catch {
        // ignore polling errors
      }
    };

    void poll();
    const id = window.setInterval(poll, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [token, userIsLoggedIn, showNotification, t, myUid]);

  return null;
};

export default FamilyActivityWatcher;
