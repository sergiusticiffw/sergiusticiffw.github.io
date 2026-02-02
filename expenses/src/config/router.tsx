import React, { Suspense } from 'react';
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { ErrorBoundary, LoadingSpinner } from '@components/Common';
import Navbar from '@components/Navbar';
import SyncStatusIndicator from '@components/Common/SyncStatusIndicator';
import Income from '@pages/Income';
import LazyCharts from '@pages/LazyCharts';
import Profile from '@pages/Profile';
import Login from '@pages/Login';
import NewHome from '@pages/NewHome';
import Loans from '@pages/Loans';
import Loan from '@pages/Loan';
import { logger } from '@utils/logger';
import { getStoredToken } from '@utils/authStorage';

function requireAuth() {
  if (!getStoredToken()) throw redirect({ to: '/expenses/login' });
}

function RootComponent() {
  return (
    <div className="app-container">
      <SyncStatusIndicator />
      <Navbar />
      <main className="main-content">
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
