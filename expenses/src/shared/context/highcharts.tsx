/**
 * Highcharts theme/config. Reads from localStorage (synced with settingsStore).
 * Apply on every page that renders charts so theme is correct after Profile update and after refresh.
 */
import React, { useEffect, ReactNode } from 'react';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import BrandDark from 'highcharts/themes/brand-dark';

const THEME_KEY = 'theme';
const CHARTS_BG_KEY = 'useChartsBackgroundColor';

export function applyHighchartsConfig(): void {
  Highcharts.setOptions(BrandDark.theme);
  Highstock.setOptions(BrandDark.theme);

  const bgColors: Record<string, string> = {
    'carrot-orange': '#102433',
    inchworm: '#201f1e',
  };
  let theme = 'blue-pink-gradient';
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t) theme = JSON.parse(t);
  } catch {
    // use default
  }
  const useChartsBgRaw = localStorage.getItem(CHARTS_BG_KEY);
  const useChartsBg = useChartsBgRaw === 'true' || useChartsBgRaw === true;

  const chartTheme = {
    tooltip: { style: { fontSize: '15px' } },
    ...(!useChartsBg && {
      chart: { backgroundColor: theme ? bgColors[theme] : '#282a36' },
    }),
  };
  Highcharts.setOptions(chartTheme);
  Highstock.setOptions(chartTheme);

  Highcharts.setOptions({
    plotOptions: {
      series: { animation: false, boostThreshold: 4000 },
    },
  });
  Highstock.setOptions({
    plotOptions: {
      series: { animation: false, boostThreshold: 4000 },
    },
  });
}

/**
 * Call on any page that renders Highcharts. Applies current theme from localStorage on mount
 * and when theme/chartsBackground change (so Profile update applies on all pages and after refresh).
 */
export function useChartsThemeSync(): void {
  useEffect(() => {
    applyHighchartsConfig();
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CHARTS_BG_KEY || e.key === THEME_KEY) {
        applyHighchartsConfig();
      }
    };
    const onCustom = (e: Event) => {
      const d = (e as CustomEvent).detail as { key?: string } | undefined;
      if (d?.key === CHARTS_BG_KEY || d?.key === THEME_KEY) {
        applyHighchartsConfig();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('localStorageChange', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('localStorageChange', onCustom);
    };
  }, []);
}

interface HighchartsProviderProps {
  children: ReactNode;
}

export const HighchartsProvider: React.FC<HighchartsProviderProps> = ({
  children,
}) => {
  useChartsThemeSync();
  return <>{children}</>;
};
