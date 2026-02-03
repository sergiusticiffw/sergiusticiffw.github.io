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
import './Login.scss';

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
    <div className="login-container">
      <h4>{t('login.pleaseLogin')}</h4>
      {errorMessage ? (
        <p>
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
        className="login-button"
        disabled={loading}
      >
        <FiLogIn />
        {loading ? t('login.signingIn') : t('login.signInWithGoogle')}
      </button>
    </div>
  );
};

export default Login;
