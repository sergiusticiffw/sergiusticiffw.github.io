import type * as Highcharts from 'highcharts';

type CategorySeries = {
  data: Array<[string, number | null]>;
  [k: string]: unknown;
};

export type CategoryChartPoint = {
  name: string;
  y: number;
  color?: string;
};

/**
 * Clean category donut: no labels, legend, or center total — details via tooltip.
 */
export function buildCategoryDonutChartOptions(
  data: CategoryChartPoint[],
  currency: string,
  opts?: {
    height?: number | string;
    formatNumber?: (value: unknown) => string;
  }
): Highcharts.Options {
  const formatNumber = opts?.formatNumber;

  return {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      height: opts?.height ?? 280,
      spacing: [4, 4, 4, 4],
      margin: [8, 8, 8, 8],
    },
    title: { text: undefined },
    tooltip: {
      headerFormat: '',
      pointFormatter: function () {
        const p = this as Highcharts.Point;
        const amount = formatNumber
          ? formatNumber(p.y)
          : String(p.y ?? '');
        const pct = p.percentage?.toFixed(1) ?? '0';
        return `<span style="color:${p.color}">●</span> <b>${p.name}</b><br/>${amount} ${currency} (${pct}%)`;
      },
    },
    accessibility: {
      point: {
        valueSuffix: '%',
      },
    },
    legend: { enabled: false },
    plotOptions: {
      pie: {
        allowPointSelect: false,
        cursor: 'pointer',
        borderRadius: 0,
        borderWidth: 1.5,
        borderColor: 'var(--color-app-bg, #0a0a0a)',
        innerSize: '68%',
        size: '92%',
        showInLegend: false,
        dataLabels: { enabled: false },
        states: {
          hover: {
            brightness: 0.08,
            halo: { size: 6 },
          },
        },
      },
      series: {
        animation: false,
      },
    },
    series: [
      {
        type: 'pie',
        name: currency,
        colorByPoint: true,
        data: data.map((d) => ({
          name: d.name,
          y: d.y,
          color: d.color,
        })),
      },
    ],
    credits: { enabled: false },
  };
}

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

