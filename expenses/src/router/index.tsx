import React, { Suspense, lazy } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ErrorBoundary, LoadingSpinner } from '@shared/components/Common';
import Navbar from '@shared/components/Navbar';
import SyncStatusIndicator from '@shared/components/Common/SyncStatusIndicator';
import Income from '@features/incomes/pages/Income';
import Profile from '@shared/pages/Profile';

const LazyCharts = lazy(() => import('@features/expenses/pages/LazyCharts'));
import Login from '@shared/pages/Login';
import NewHome from '@features/expenses/pages/NewHome';
import Loans from '@features/loans/pages/Loans';
import Loan from '@features/loans/pages/Loan';
import { logger } from '@shared/utils/logger';
import { getStoredToken } from '@shared/utils/authStorage';

function requireAuth() {
  if (!getStoredToken()) throw redirect({ to: '/expenses/login' });
}

function RootComponent() {
  return (
    <div className="app-container" style={{ background: 'var(--color-app-bg)' }}>
      <SyncStatusIndicator />
      <Navbar />
      <main className="main-content" style={{ background: 'var(--color-app-bg)' }}>
        <Suspense fallback={<LoadingSpinner />}>
          <ErrorBoundary
            onError={(error, errorInfo) => {
              logger.error(
                'Application error caught by ErrorBoundary:',
                error,
                errorInfo
              );
            }}
          >
            <Outlet />
          </ErrorBoundary>
        </Suspense>
      </main>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: RootComponent,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses',
  beforeLoad: requireAuth,
  component: NewHome,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/login',
  component: Login,
});

const chartsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/charts',
  beforeLoad: requireAuth,
  component: LazyCharts,
  pendingComponent: LoadingSpinner,
});

const incomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/income',
  beforeLoad: requireAuth,
  component: Income,
});

const loansRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/loans',
  beforeLoad: requireAuth,
  component: Loans,
});

const loanIdRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/loan/$id',
  beforeLoad: requireAuth,
  component: Loan,
});

const userRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/user',
  beforeLoad: requireAuth,
  component: Profile,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  chartsRoute,
  incomeRoute,
  loansRoute,
  loanIdRoute,
  userRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
