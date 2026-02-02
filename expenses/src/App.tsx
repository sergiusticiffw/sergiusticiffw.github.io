import './App.scss';
import { AuthProvider } from '@context/context';
import { NotificationProvider } from '@context/notification';
import { LoanProvider } from '@context/loan';
import { HighchartsProvider } from '@context/highcharts';
import { LocalizationProvider } from '@context/localization';
import { RouterProvider } from '@tanstack/react-router';
import { ErrorBoundary } from '@components/Common';
import React from 'react';
import { router } from '@config/router';
import { logger } from '@utils/logger';

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
        <LocalizationProvider>
          <NotificationProvider>
            <LoanProvider>
              <HighchartsProvider>
                <RouterProvider router={router} />
              </HighchartsProvider>
            </LoanProvider>
          </NotificationProvider>
        </LocalizationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
