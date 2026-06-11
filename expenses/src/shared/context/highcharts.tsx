/**
 * Highcharts config: adaptive dark theme + app-specific chart defaults.
 */
import React, { useEffect, ReactNode } from 'react';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import 'highcharts/themes/adaptive';
import { useSettingsTheme } from '@stores/settingsStore';

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

  // Side-effect import applies adaptive theme on Highcharts; sync Highstock entry point
  const adaptiveTheme = (
    Highcharts as typeof Highcharts & { theme?: Highcharts.Options }
  ).theme;
  if (adaptiveTheme) {
    Highstock.setOptions(adaptiveTheme);
  }

  setOptionsOnAll(buildAppChartOptions());
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
