import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { FiLock, FiLogIn } from 'react-icons/fi';
import { useNavigate } from '@tanstack/react-router';
import { googleLogout } from '@react-oauth/google';
import { useAuthDispatch } from '@shared/context/context';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { logout } from '@shared/context/actions';
import {
  assertBiometric,
  clearUnlocked,
  clearUnlockOnLogout,
  isBiometricEnabled,
  isUnlocked,
  markHidden,
  shouldRelockAfterIdle,
} from './biometricLock';

interface BiometricLockGateProps {
  userId: string;
  children: ReactNode;
}

const BiometricLockGate = ({ userId, children }: BiometricLockGateProps) => {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const dispatch = useAuthDispatch();
  const { dataDispatch } = useExpenseData();
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncLockState = useCallback(() => {
    if (!userId) {
      setLocked(false);
      setReady(true);
      return;
    }
    if (!isBiometricEnabled(userId)) {
      setLocked(false);
      setReady(true);
      return;
    }
    setLocked(!isUnlocked(userId));
    setReady(true);
  }, [userId]);

  useEffect(() => {
    syncLockState();
  }, [syncLockState]);

  useEffect(() => {
    if (!ready || !locked) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setPending(true);
      setError(null);
      const result = await assertBiometric(userId);
      if (cancelled) {
        return;
      }
      setPending(false);
      if (result.error) {
        return;
      }
      setLocked(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, locked, userId]);

  useEffect(() => {
    function onVisibility() {
      if (!userId || !isBiometricEnabled(userId)) {
        return;
      }
      if (document.visibilityState === 'hidden') {
        markHidden(userId);
        return;
      }
      if (shouldRelockAfterIdle(userId)) {
        clearUnlocked(userId);
        setLocked(true);
        setError(null);
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [userId]);

  const unlockWithBiometric = async () => {
    setPending(true);
    setError(null);
    const result = await assertBiometric(userId);
    setPending(false);
    if (result.error) {
      setError(t(result.error));
      return;
    }
    setLocked(false);
  };

  const unlockWithGoogle = async () => {
    setPending(true);
    setError(null);
    clearUnlockOnLogout(userId);
    googleLogout();
    await logout(dispatch, dataDispatch);
    setPending(false);
    navigate({ to: '/expenses/login' });
  };

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center text-sm text-app-muted">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <>
      <div
        className={locked ? 'hidden' : 'contents'}
        aria-hidden={locked || undefined}
      >
        {children}
      </div>
      {locked ? (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[var(--color-app-bg)]/95 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[var(--color-surface)]/90 p-6 text-app-primary shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-app-accent)]/15 border border-[var(--color-app-accent)]/25 text-[var(--color-app-accent)]">
              <FiLock className="text-xl" aria-hidden />
            </div>
            <h2 className="m-0 text-lg font-semibold tracking-tight">
              {t('biometric.lockTitle')}
            </h2>
            <p className="mt-1 mb-0 text-sm text-app-muted">
              {t('biometric.lockBody')}
            </p>
            {error ? (
              <p role="alert" className="mt-3 mb-0 text-sm text-red-400">
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void unlockWithBiometric();
                }}
                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl border border-[var(--color-border-subtle)] bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-[var(--color-btn-on-accent)] text-sm font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiLock aria-hidden />
                {pending ? t('biometric.unlocking') : t('biometric.unlock')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  void unlockWithGoogle();
                }}
                className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl border border-white/15 bg-transparent text-app-primary text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiLogIn aria-hidden />
                {t('biometric.useGoogle')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BiometricLockGate;
