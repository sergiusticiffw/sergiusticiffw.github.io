import React from 'react';
import { useAuthDispatch, useAuthState } from '@shared/context/context';
import { useLocalization } from '@shared/context/localization';
import { loginUser } from '@shared/context/actions';
import { hydrateSettings } from '@stores/settingsStore';
import { useNavigate } from '@tanstack/react-router';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { FiLogIn, FiLock } from 'react-icons/fi';
import { logger } from '@shared/utils/logger';
import { useNotificationManager } from '@shared/context/notification';

const Login = () => {
  const dispatch = useAuthDispatch();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const { loading, errorMessage, userIsLoggedIn } = useAuthState();
  const { clearAllNotifications } = useNotificationManager();

  // Clear all notifications when user successfully logs in
  React.useEffect(() => {
    if (userIsLoggedIn) {
      clearAllNotifications();
      navigate({ to: '/expenses' });
    }
  }, [userIsLoggedIn, navigate, clearAllNotifications]);

  const handleLogin = async (googleResponse: TokenResponse) => {
    if ('access_token' in googleResponse) {
      const payload = { access_token: googleResponse.access_token };
      try {
        const response = await loginUser(dispatch, payload);
        if (response && !response.current_user) {
          return;
        }
        if (response?.current_user?.currency) {
          hydrateSettings({ currency: response.current_user.currency });
        }
        clearAllNotifications();
        navigate({ to: '/expenses' });
      } catch (error) {
        logger.error('Login error:', error);
      }
    }
  };

  const failedResponseGoogle = (response: Response) => {
    logger.log('Login response:', response);
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleLogin,
    onError: failedResponseGoogle,
    onNonOAuthError: failedResponseGoogle,
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-full w-full p-6 md:p-8 text-center relative box-border overflow-hidden bg-[var(--color-app-bg)] bg-gradient-to-b from-[var(--color-app-bg)] via-[color-mix(in_srgb,var(--color-app-accent)_6%,var(--color-app-bg))] to-[var(--color-app-bg)]">
      {/* Subtle accent glow */}
      <div
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[80%] max-w-[400px] h-[300px] rounded-full bg-[var(--color-app-accent)] opacity-[0.08] blur-[80px] pointer-events-none"
        aria-hidden
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[50%] max-w-[280px] h-[200px] rounded-full bg-[var(--color-app-accent)] opacity-[0.05] blur-[60px] pointer-events-none"
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-[420px] flex flex-col items-center">
        <div className="w-full rounded-3xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 backdrop-blur-xl shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)] p-8 md:p-10 flex flex-col items-center gap-6 text-center">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-app-accent)]/15 border border-[var(--color-app-accent)]/25 text-[var(--color-app-accent)]">
            <FiLock className="text-2xl" aria-hidden />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-[var(--color-text-primary)] text-2xl md:text-[1.75rem] font-semibold tracking-tight">
              {t('login.pleaseLogin')}
            </h1>
            <p className="text-[var(--color-text-muted)] text-sm md:text-base leading-relaxed max-w-[320px] mx-auto">
              {t('login.subtitle')}
            </p>
          </div>
          {errorMessage ? (
            <p
              className="w-full text-red-400 text-sm font-medium py-3 px-4 rounded-xl bg-red-500/10 border border-red-500/20"
              role="alert"
            >
              {t('login.errors')}: {errorMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => googleLogin()}
            className="flex items-center justify-center gap-3 w-full py-4 px-6 text-base font-semibold min-h-[52px] rounded-xl transition-all duration-300 shadow-[0_4px_20px_var(--color-app-accent-shadow)] border border-[var(--color-border-subtle)] bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-[var(--color-btn-on-accent)] hover:-translate-y-0.5 hover:shadow-[0_8px_28px_var(--color-app-accent-shadow)] hover:border-[var(--color-border-medium)] active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none [&_svg]:shrink-0 [&_svg]:text-xl [&_svg]:drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]"
            disabled={loading}
          >
            <FiLogIn aria-hidden />
            {loading ? t('login.signingIn') : t('login.signInWithGoogle')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
