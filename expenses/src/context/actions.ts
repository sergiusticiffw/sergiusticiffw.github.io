import { LoginPayload, UserData } from '@type/types';
import AES from 'crypto-js/aes';

const ROOT_URL = 'https://dev-expenses-api.pantheonsite.io';

export const loginUser = async (dispatch: any, loginPayload: LoginPayload) => {
  const requestOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(loginPayload),
  };

  try {
    dispatch({ type: 'REQUEST_LOGIN' });
    const response = await fetch(
      `${ROOT_URL}/user/login/google?_format=json`,
      requestOptions
    );
    const data: UserData = await response.json();

    if (data.current_user) {
      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
      const encryptedData = AES.encrypt(
        JSON.stringify(data),
        import.meta.env.VITE_CRYPT_KEY
      ).toString();
      localStorage.setItem('currentUser', encryptedData);
      return data;
    }

    dispatch({ type: 'LOGIN_ERROR', error: data.errors[0] });
  } catch (error) {
    dispatch({ type: 'LOGIN_ERROR', error: error });
  }
};

export const logout = async (dispatch: any, dataDispatch: any) => {
  await dispatch({ type: 'LOGOUT' });
  await dataDispatch({ type: 'REMOVE_DATA' });
  await localStorage.removeItem('currentUser');
  await localStorage.removeItem('token');
};
