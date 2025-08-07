
import { AuthProvider } from '@context/context';
import { NotificationProvider } from '@context/notification';
import { LoanProvider } from '@context/loan';
import { HighchartsProvider } from '@context/highcharts';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { AppRoute } from '@components/Common';
import React, { Suspense, useMemo, useEffect } from 'react';
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
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ error, resetErrorBoundary }) => (
  <div className="error-container">
    <h2>Something went wrong</h2>
    <p>{error.message}</p>
    <button onClick={resetErrorBoundary} className="button">
      Try again
    </button>
  </div>
);

const App: React.FC = () => {
  // Force dark mode on mount
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

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
      <NotificationProvider>
        <LoanProvider>
          <HighchartsProvider>
            <Router>
                              <div className="min-h-screen flex bg-background dark">
                  <Navbar />
                  <main className="flex-1 ml-0 md:ml-72 overflow-y-auto min-h-screen p-4">
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
    </AuthProvider>
  );
};

export default App;
