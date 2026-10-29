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
        <div className="fixed inset-0 z-[200] box-border flex flex-col items-center justify-center overflow-y-auto bg-[var(--color-app-bg)]/95 px-6 py-8 backdrop-blur-sm">
          <div
            className="absolute top-[-20%] left-1/2 h-[280px] w-[80%] max-w-[400px] -translate-x-1/2 rounded-full bg-[var(--color-app-accent)] opacity-[0.08] blur-[80px] pointer-events-none"
            aria-hidden
          />
          <div className="relative z-10 w-full max-w-[420px] shrink-0">
            <div className="flex w-full flex-col items-center gap-6 rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 p-8 text-center shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-10">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-app-accent)]/25 bg-[var(--color-app-accent)]/15 text-[var(--color-app-accent)]">
                <FiLock className="text-2xl" aria-hidden />
              </div>
              <div className="flex w-full flex-col gap-2">
                <h2 className="m-0 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)] md:text-[1.75rem]">
                  {t('biometric.lockTitle')}
                </h2>
                <p className="mx-auto mb-0 mt-0 max-w-[320px] text-sm leading-relaxed text-[var(--color-text-muted)] md:text-base">
                  {t('biometric.lockBody')}
                </p>
              </div>
              {error ? (
                <p
                  role="alert"
                  className="m-0 w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400"
                >
                  {error}
                </p>
              ) : null}
              <div className="flex w-full flex-col gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    void unlockWithBiometric();
                  }}
                  className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] px-6 py-4 text-base font-semibold text-[var(--color-btn-on-accent)] shadow-[0_4px_20px_var(--color-app-accent-shadow)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--color-border-medium)] hover:shadow-[0_8px_28px_var(--color-app-accent-shadow)] active:translate-y-0 disabled:transform-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0 [&_svg]:text-xl"
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
                  className="flex min-h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-white/15 bg-transparent px-6 py-4 text-base font-medium text-[var(--color-text-primary)] transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:shrink-0 [&_svg]:text-xl"
                >
                  <FiLogIn aria-hidden />
                  {t('biometric.useGoogle')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default BiometricLockGate;
