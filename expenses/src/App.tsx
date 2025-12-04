import './App.scss';
import { AuthProvider } from '@context/context';
import { NotificationProvider } from '@context/notification';
import { LoanProvider } from '@context/loan';
import { HighchartsProvider } from '@context/highcharts';
import { LocalizationProvider } from '@context/localization';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AppRoute, ErrorBoundary } from '@components/Common';
import React, { Suspense, useMemo } from 'react';
import routes from '@config/routes';
import Navbar from '@components/Navbar';
import SyncStatusIndicator from '@components/Common/SyncStatusIndicator';
import { logger } from '@utils/logger';

// Loading component for Suspense fallback
const LoadingFallback: React.FC = () => (
  <div className="loading-container">
    <div className="loader">
      <span className="loader__element"></span>
      <span className="loader__element"></span>
      <span className="loader__element"></span>
    </div>
  </div>
);

const App: React.FC = () => {
  // Memoize routes to prevent unnecessary re-renders
  const appRoutes = useMemo(
    () =>
      routes.map((route) => (
        <Route
          key={route.path}
          path={route.path}
          element={
            <AppRoute component={route.component} isPrivate={route.isPrivate} />
          }
        />
      )),
    []
  );

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log error to error reporting service if needed
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
                <Router>
                  <div className="app-container">
                    <SyncStatusIndicator />
                    <Navbar />
                    <main className="main-content">
                      <Suspense fallback={<LoadingFallback />}>
                        <ErrorBoundary>
                          <Routes>{appRoutes}</Routes>
                        </ErrorBoundary>
                      </Suspense>
                    </main>
                  </div>
                </Router>
              </HighchartsProvider>
            </LoanProvider>
          </NotificationProvider>
        </LocalizationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;
