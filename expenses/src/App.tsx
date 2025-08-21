import './App.scss';
import { AuthProvider } from '@context/context';
import { NotificationProvider } from '@context/notification';
import { LoanProvider } from '@context/loan';
import { HighchartsProvider } from '@context/highcharts';
import { LocalizationProvider, useLocalization } from '@context/localization';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AppRoute } from '@components/Common';
import React, { Suspense, useMemo } from 'react';
import routes from '@config/routes';
import Navbar from '@components/Navbar';

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

// Error boundary component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ error, resetErrorBoundary }) => {
  const { t } = useLocalization();
  return (
    <div className="error-container">
      <h2>{t('error.unknown')}</h2>
      <p>{error.message}</p>
      <button onClick={resetErrorBoundary} className="button">
        {t('common.tryAgain')}
      </button>
    </div>
  );
};

const App: React.FC = () => {
  // Memoize routes to prevent unnecessary re-renders
  const appRoutes = useMemo(() => 
    routes.map((route) => (
      <Route
        key={route.path}
        path={route.path}
        element={
          <AppRoute
            component={route.component}
            isPrivate={route.isPrivate}
          />
        }
      />
    )), []
  );

  return (
    <AuthProvider>
      <LocalizationProvider>
        <NotificationProvider>
          <LoanProvider>
            <HighchartsProvider>
              <Router>
                <div className="app-container">
                  <Navbar />
                  <main className="main-content">
                    <Suspense fallback={<LoadingFallback />}>
                      <Routes>
                        {appRoutes}
                      </Routes>
                    </Suspense>
                  </main>
                </div>
              </Router>
            </HighchartsProvider>
          </LoanProvider>
        </NotificationProvider>
      </LocalizationProvider>
    </AuthProvider>
  );
};

export default App;
