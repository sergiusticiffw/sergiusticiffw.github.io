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
const LazyAssistant = lazy(() => import('@features/assistant/pages/Assistant'));
import Login from '@shared/pages/Login';
import NewHome from '@features/expenses/pages/NewHome';
import Loans from '@features/loans/pages/Loans';
import Loan from '@features/loans/pages/Loan';
import { logger } from '@shared/utils/logger';
import { getStoredToken } from '@shared/utils/authStorage';
import { useAuthState } from '@shared/context/context';
import {
  needsEncryptionKey,
  useEncryptionState,
} from '../crypto/encryptionState';
import KeyNeededScreen from '../features/privacy/KeyNeededScreen';
import MigrationProgress from '../features/privacy/MigrationProgress';
import BiometricLockGate from '../features/privacy/BiometricLockGate';

function requireAuth() {
  if (!getStoredToken()) throw redirect({ to: '/expenses/login' });
}

function RootComponent() {
  const { token, userDetails } = useAuthState();
  const encryption = useEncryptionState();
  const lockedOut = !!token && needsEncryptionKey(encryption);
  const userId = String(userDetails?.current_user?.uid ?? '');

  const shell = (
    <div className="h-dvh w-full max-w-full flex flex-col overflow-hidden bg-[var(--color-app-bg)]">
      <SyncStatusIndicator />
      <MigrationProgress />
      <Navbar />
      <main
        className="main-content flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(95px+env(safe-area-inset-bottom,0px))] w-full relative block scroll-smooth bg-[var(--color-app-bg)] overflow-touch"
      >
        {lockedOut ? (
          <KeyNeededScreen />
        ) : (
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
        )}
      </main>
    </div>
  );

  if (!token || !userId) {
    return shell;
  }

  return <BiometricLockGate userId={userId}>{shell}</BiometricLockGate>;
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

const assistantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/expenses/assistant',
  beforeLoad: requireAuth,
  component: LazyAssistant,
  pendingComponent: LoadingSpinner,
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
  assistantRoute,
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
