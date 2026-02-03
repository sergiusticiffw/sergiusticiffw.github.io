import { loginUser, logout } from '@shared/context/actions';
import { AuthProvider, useAuthDispatch, useAuthState } from './context';
import {
  NotificationProvider,
  useNotification,
} from '@shared/context/notification';
import {
  LocalizationProvider,
  useLocalization,
} from '@shared/context/localization';
import { ThemeProvider } from './theme';

export { AuthProvider, useAuthState, useAuthDispatch };
export { loginUser, logout };
export {
  useNotification,
  NotificationProvider,
  LocalizationProvider,
  useLocalization,
};
export { ThemeProvider };
