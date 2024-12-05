import './App.scss';
import { AuthProvider } from '@context/context';
import { NotificationProvider } from '@context/notification';
import { LoanProvider } from '@context/loan';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AppRoute from '@components/AppRoute';
import React from 'react';
import routes from '@config/routes';
import Navbar from '@components/Navbar';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import BrandDark from 'highcharts/themes/brand-dark';

Highcharts.setOptions(BrandDark.theme);
Highstock.setOptions(BrandDark.theme);

const bgColors: Record<string, string> = {
  'carrot-orange': '#102433',
  inchworm: '#201f1e',
};
const theme = localStorage.getItem('theme') || 'blue-pink-gradient';
const useChartsBackgroundColor = localStorage.getItem('useChartsBackgroundColor');

Highcharts.theme = {
  tooltip: {
    style: {
      fontSize: '15px',
    },
  },
};
if (useChartsBackgroundColor != 'true') {
  Highcharts.theme = {
    chart: {
      backgroundColor: theme ? bgColors[theme] : '#282a36',
    },
    tooltip: {
      style: {
        fontSize: '15px',
      },
    },
  };
}

Highcharts.setOptions(Highcharts.theme);
Highstock.setOptions(Highcharts.theme);
Highcharts.setOptions({
  plotOptions: {
    series: {
      animation: false,
      boostThreshold: 4000,
    },
  },
});
Highstock.setOptions({
  plotOptions: {
    series: {
      animation: false,
      boostThreshold: 4000,
    },
  },
});

const App = () => {
  return (
    <AuthProvider>
      <NotificationProvider>
        <LoanProvider>
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
        </LoanProvider>
      </NotificationProvider>
    </AuthProvider>
  );
};

export default App;
