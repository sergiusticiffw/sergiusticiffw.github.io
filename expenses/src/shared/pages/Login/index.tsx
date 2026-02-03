import React from 'react';
import { useAuthDispatch, useAuthState } from '@shared/context/context';
import { useLocalization } from '@shared/context/localization';
import { loginUser } from '@shared/context/actions';
import { hydrateSettings } from '@stores/settingsStore';
import { useNavigate } from '@tanstack/react-router';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { FiLogIn } from 'react-icons/fi';
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 md:p-5 text-center relative">
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(500px,90%)] md:w-[95%] min-h-[300px] md:min-h-[280px] bg-white/[0.03] border border-white/[0.08] rounded-3xl md:rounded-[20px] backdrop-blur-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] z-0"
        aria-hidden
      />
      <div className="relative z-10">
        <h4 className="text-white/95 text-3xl md:text-2xl mb-5 md:mb-5 max-w-[500px] leading-snug font-semibold tracking-tight">
          {t('login.pleaseLogin')}
        </h4>
        {errorMessage ? (
          <p className="text-red-400 mb-5 text-base font-medium py-4 px-4 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[400px]">
            {t('login.errors')}: {errorMessage}
          </p>
        ) : null}
        <button
          // @ts-expect-error
          onClick={useGoogleLogin({
            onSuccess: handleLogin,
            onError: failedResponseGoogle,
            onNonOAuthError: failedResponseGoogle,
          })}
          className="flex items-center justify-center gap-4 py-4 px-6 md:py-3 md:px-5 text-lg md:text-base font-semibold min-w-[280px] md:min-w-[240px] min-h-[56px] md:min-h-[52px] rounded-xl transition-all duration-300 shadow-[0_4px_16px_rgba(91,141,239,0.3)] border border-white/10 bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] text-white hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(91,141,239,0.4)] hover:border-white/20 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-[0_4px_16px_rgba(91,141,239,0.2)] [&_svg]:text-[1.3em] md:[&_svg]:text-[1.2em] [&_svg]:drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
          disabled={loading}
        >
          <FiLogIn />
          {loading ? t('login.signingIn') : t('login.signInWithGoogle')}
        </button>
      </div>
    </div>
  );
};

export default Login;
