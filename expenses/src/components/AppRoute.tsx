import React, { Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthState } from '@context/context';
import { AuthState } from '@type/types';

interface AppRouteProps {
  component: React.ComponentType<any>;
  isPrivate: boolean;
}

const AppRoute: React.FC<AppRouteProps> = ({
  component: Component,
  isPrivate,
}) => {
  const { token } = useAuthState() as AuthState;

  if (isPrivate && !token) {
    return <Navigate to="/expenses/login" />;
  }

  return (
    <Suspense fallback="">
      <Component />
    </Suspense>
  );
};

export default AppRoute;
