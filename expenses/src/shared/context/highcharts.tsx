/**
 * Highcharts config: adaptive dark theme + app-specific chart defaults.
 * Chart background follows app theme via CSS (--color-app-bg).
 */
import React, { useEffect, ReactNode } from 'react';
import Highcharts from 'highcharts';
import Highstock from 'highcharts/highstock';
import 'highcharts/themes/adaptive';

const APP_CHART_OPTIONS: Highcharts.Options = {
  tooltip: { style: { fontSize: '15px' } },
  plotOptions: {
    series: { animation: false, boostThreshold: 4000 },
  },
};

let initialized = false;

function initHighchartsOnce(): void {
  if (initialized) return;
  initialized = true;

  document.documentElement.classList.add('highcharts-dark');

  const adaptiveTheme = (
    Highcharts as typeof Highcharts & { theme?: Highcharts.Options }
  ).theme;
  if (adaptiveTheme) {
    Highstock.setOptions(adaptiveTheme);
  }

  Highcharts.setOptions(APP_CHART_OPTIONS);
  Highstock.setOptions(APP_CHART_OPTIONS);
}

export function applyHighchartsConfig(): void {
  initHighchartsOnce();
}

/** Ensures Highcharts is configured before charts render. */
export function useChartsThemeSync(): void {
  useEffect(() => {
    initHighchartsOnce();
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

initHighchartsOnce();
