import React from 'react';
import GoogleLogin, {
  GoogleLoginResponse,
  GoogleLoginResponseOffline,
} from 'react-google-login';
import { loginUser, useAuthDispatch, useAuthState } from '../../context';
import { useNavigate } from 'react-router-dom';
import { AuthState } from '../../type/types';

const Login = () => {
  const dispatch = useAuthDispatch();
  const navigate = useNavigate();
  const { loading, errorMessage, userIsLoggedIn } = useAuthState() as AuthState;

  if (userIsLoggedIn) {
    navigate('/expenses');
  }

  const handleLogin = async (
    googleResponse: GoogleLoginResponse | GoogleLoginResponseOffline
  ) => {
    if ('accessToken' in googleResponse) {
      const payload = { access_token: googleResponse.accessToken };
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
      <GoogleLogin
        clientId="14695610160-ui3d8l2qa7tdjfi4s1t46hfl609qcmie.apps.googleusercontent.com"
        buttonText="Login"
        render={(renderProps) => (
          <button
            onClick={renderProps.onClick}
            className="button wide"
            disabled={loading}
          >
            Log in
          </button>
        )}
        onSuccess={handleLogin}
        onFailure={failedResponseGoogle}
        cookiePolicy={'single_host_origin'}
        disabled={loading}
      />
    </div>
  );
};

export default Login;
