import './App.scss';
import { AuthProvider, ThemeProvider } from '@shared/context';
import { NotificationProvider } from '@shared/context/notification';
import { LocalizationProvider } from '@shared/context/localization';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from '@shared/components/Common';
import React from 'react';
import { router } from '@router';
import { logger } from '@shared/utils/logger';

const App: React.FC = () => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        logger.error(
          'Application error caught by ErrorBoundary:',
          error,
          errorInfo
        );
      }}
    >
      <AuthProvider>
        <ThemeProvider>
          <LocalizationProvider>
            <NotificationProvider>
              <RouterProvider router={router} />
            </NotificationProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
