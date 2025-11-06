import React from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { useLocalization } from '@context/localization';
import { loginUser } from '@context/actions';
import { useNavigate } from 'react-router-dom';
import { AuthState } from '@type/types';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { FiLogIn } from 'react-icons/fi';
import './Login.scss';

const Login = () => {
  const dispatch = useAuthDispatch();
  const navigate = useNavigate();
  const { t } = useLocalization();
  const { loading, errorMessage, userIsLoggedIn } = useAuthState() as AuthState;

  if (userIsLoggedIn) {
    navigate('/expenses');
  }

  const handleLogin = async (googleResponse: TokenResponse) => {
    if ('access_token' in googleResponse) {
      const payload = { access_token: googleResponse.access_token };
      try {
        const response = await loginUser(dispatch, payload);
        if (response && !response.current_user) {
          return;
        }
        navigate(`/expenses`);
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Login error:', error);
        }
      }
    }
  };

  const failedResponseGoogle = (response: Response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Login response:', response);
    }
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
