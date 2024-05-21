import './App.scss';
import { AuthProvider } from '@context/context';
import { NotificationProvider } from '@context/notification';
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AppRoute from '@components/AppRoute';
import React from 'react';
import routes from '@config/routes';
import Navbar from '@components/Navbar';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import Boost from 'highcharts/modules/boost';
import DarkUnica from 'highcharts/themes/dark-unica';
import NoData from 'highcharts/modules/no-data-to-display';

Boost(Highcharts);
DarkUnica(Highcharts);
NoData(Highcharts);
Boost(Highstock);
DarkUnica(Highstock);
NoData(Highstock);

const bgColors: Record<string, string> = {
  'carrot-orange': '#102433',
  inchworm: '#201f1e',
};
const theme = localStorage.getItem('theme') || 'blue-pink-gradient';

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

Highcharts.setOptions(Highcharts.theme);
// Radialize the colors
Highcharts.setOptions({
  colors:
    (Highcharts.getOptions().colors || []).map(
      (
        color:
          | string
          | Highcharts.GradientColorObject
          | Highcharts.PatternObject
      ) => {
        return {
          radialGradient: {
            cx: 0.5,
            cy: 0.3,
            r: 0.7,
          },
          stops: [
            [0, color],
            [
              1,
              Highcharts.color(color as string)
                .brighten(-0.25)
                .get('rgb'),
            ], // darken
          ] as Highcharts.GradientColorObject['stops'],
        };
      }
    ) ?? [],
});
Highcharts.setOptions({
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
