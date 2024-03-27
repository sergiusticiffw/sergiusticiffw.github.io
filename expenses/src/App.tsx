import './App.scss';
import { AuthProvider } from '@context/context';
import { NotificationProvider } from '@context/notification';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AppRoute from '@components/AppRoute';
import React from 'react';
import routes from '@config/routes';
import Navbar from '@components/Navbar';

const App = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Navbar />

          <Routes>
            {routes.map((route) => (
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
            ))}
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
