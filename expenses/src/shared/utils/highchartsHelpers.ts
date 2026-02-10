import type * as Highcharts from 'highcharts';

type CategorySeries = {
  data: Array<[string, number | null]>;
  [k: string]: unknown;
};

/**
 * Logarithmic scale keeps trends visible with outliers, but cannot display 0/negative values.
 * Convert non-positive values to null so Highcharts won't error on logarithmic axis.
 */
export function sanitizeCategorySeriesForLogScale<T extends CategorySeries>(
  series: T[]
): T[] {
  return series.map((s) => ({
    ...s,
    data: s.data.map(([m, v]) => [m, v !== null && v <= 0 ? null : v]) as Array<
      [string, number | null]
    >,
  }));
}

export function buildLogarithmicYAxisOptions(
  currency: string,
  formatNumber: (value: unknown) => string
): Highcharts.YAxisOptions {
  return {
    type: 'logarithmic',
    title: { text: currency },
    minorTickInterval: 'auto',
    labels: {
      formatter: function () {
        return formatNumber((this as any).value);
      },
    },
  };
}

/**
 * Shared tooltip for category axes; uses `point.key` so it shows the localized category label
 * (Highcharts' `this.x` can be a numeric index for category axes).
 */
export function buildSharedCurrencyTooltipOptions(
  currency: string,
  formatNumber: (value: unknown) => string
): Highcharts.TooltipOptions {
  return {
    shared: true,
    useHTML: true,
    formatter: function () {
      const ctx = this as any;
      const points = (ctx.points ?? []) as Array<any>;
      const xLabel =
        points?.[0]?.key ?? ctx.key ?? (ctx.x !== undefined ? String(ctx.x) : '');

      const header = `<div style="margin-bottom:6px"><b>${xLabel}</b></div>`;
      const rows = points
        .map((p) => {
          const y = p?.y;
          if (y === null || y === undefined) return '';
          return `
            <div style="margin:2px 0">
              <span style="color:${p.color}">\u25CF</span>
              <span style="opacity:.9">${p.series.name}:</span>
              <b style="margin-left:6px">${formatNumber(y)} ${currency}</b>
            </div>
          `;
        })
        .filter(Boolean)
        .join('');

      return `<div style="min-width:160px">${header}${rows}</div>`;
    },
  };
}

