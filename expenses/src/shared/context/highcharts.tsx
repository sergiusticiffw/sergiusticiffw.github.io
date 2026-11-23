/**
 * Highcharts config: dark theme + app-specific chart defaults.
 */
import React, { useEffect, ReactNode } from 'react';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import { useSettingsTheme } from '@stores/settingsStore';

/** Series colors from the removed Highcharts 12 brand-dark theme. */
const BRAND_SERIES_COLORS = [
  '#8087E8',
  '#A3EDBA',
  '#F19E53',
  '#6699A1',
  '#E1D369',
  '#87B4E7',
  '#DA6D85',
  '#BBBAC5',
];

const APP_BG = 'var(--color-app-bg)';

function buildAppChartOptions(): Highcharts.Options {
  return {
    chart: { backgroundColor: APP_BG },
    tooltip: { style: { fontSize: '15px' } },
    plotOptions: {
      series: { animation: false, boostThreshold: 4000 },
    },
  };
}

function setOptionsOnAll(options: Highcharts.Options): void {
  Highcharts.setOptions(options);
  Highstock.setOptions(options);
}

function refreshRenderedCharts(): void {
  for (const chart of Highcharts.charts) {
    chart?.update({ chart: { backgroundColor: APP_BG } }, false);
    chart?.redraw(false);
  }
}

export function applyHighchartsConfig(): void {
  document.documentElement.classList.add('highcharts-dark');

  // brand-dark was removed in Highcharts 13. Dark palette keeps labels readable;
  // series colors stay the previous brand set.
  setOptionsOnAll({
    palette: {
      colorScheme: 'dark',
      colors: BRAND_SERIES_COLORS,
    },
    ...buildAppChartOptions(),
  });
  refreshRenderedCharts();
}

/** Call on any page that renders Highcharts. Re-applies when app theme changes. */
export function useChartsThemeSync(): void {
  const theme = useSettingsTheme();

  useEffect(() => {
    applyHighchartsConfig();
  }, [theme]);
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
