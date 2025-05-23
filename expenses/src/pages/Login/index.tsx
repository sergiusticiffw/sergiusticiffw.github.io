import React from 'react';
import { useAuthDispatch, useAuthState } from '@context/context';
import { loginUser } from '@context/actions';
import { useNavigate } from 'react-router-dom';
import { AuthState } from '@type/types';
import { useGoogleLogin, TokenResponse } from '@react-oauth/google';
import { FaSignInAlt } from 'react-icons/fa';

const Login = () => {
  const dispatch = useAuthDispatch();
  const navigate = useNavigate();
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
        console.log(error);
      }
    }
  };

  const failedResponseGoogle = (response: Response) => {
    console.log(response);
  };

  return (
    <div>
      <h4>Please login using Google in order to access app functionality.</h4>
      {errorMessage ? <p>We have some errors: {errorMessage}</p> : null}
      <button
        // @ts-expect-error
        onClick={useGoogleLogin({
          onSuccess: handleLogin,
          onError: failedResponseGoogle,
          onNonOAuthError: failedResponseGoogle,
        })}
        className="button wide"
        disabled={loading}
      >
        <FaSignInAlt />
      </button>
    </div>
  );
};

export default Login;
