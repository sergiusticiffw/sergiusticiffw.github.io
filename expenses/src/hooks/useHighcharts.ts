import { useEffect } from 'react';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import BrandDark from 'highcharts/themes/brand-dark';

export const useHighcharts = () => {
  useEffect(() => {
    // Set default theme
    Highcharts.setOptions(BrandDark.theme);
    Highstock.setOptions(BrandDark.theme);

    // Theme-specific background colors
    const bgColors: Record<string, string> = {
      'carrot-orange': '#102433',
      inchworm: '#201f1e',
    };

    // Get user preferences
    const theme = localStorage.getItem('theme') || 'blue-pink-gradient';
    const useChartsBackgroundColor = localStorage.getItem('useChartsBackgroundColor');

    // Configure theme
    const chartTheme = {
      tooltip: {
        style: {
          fontSize: '15px',
        },
      },
      ...(useChartsBackgroundColor !== 'true' && {
        chart: {
          backgroundColor: theme ? bgColors[theme] : '#282a36',
        },
      }),
    };

    // Apply theme
    Highcharts.setOptions(chartTheme);
    Highstock.setOptions(chartTheme);

    // Performance optimizations
    const performanceOptions = {
      plotOptions: {
        series: {
          animation: false,
          boostThreshold: 4000,
        },
      },
    };

    Highcharts.setOptions(performanceOptions);
    Highstock.setOptions(performanceOptions);
  }, []);
}; 