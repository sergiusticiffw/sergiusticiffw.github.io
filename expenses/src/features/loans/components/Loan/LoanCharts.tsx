import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';
import { getLocale } from '@shared/utils/utils';

type PaymentLogLike = {
  date: string;
  principal: number | string;
  installment?: number | string;
  reduction: number | string;
  interest: number | string;
  fee?: number | string;
  was_payed?: boolean | null;
};

function parseDateToUtcMs(date: string): number | null {
  const parts = date.split('.');
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (!dd || !mm || !yyyy) return null;
  return Date.UTC(yyyy, mm - 1, dd);
}

function toNum(v: unknown): number | null {
  if (v === '-' || v === '' || v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const LoanCostBreakdown = ({ data }) => {
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const { principal, sumOfInterest, sumInstallments } = data;

  const options = {
    chart: {
      type: 'column',
    },
    title: {
      text: t('loan.loanCostBreakdown'),
    },
    xAxis: {
      categories: [
        t('loan.principal'),
        t('loan.interests'),
        t('loan.installments'),
      ],
    },
    yAxis: {
      min: 0,
      title: {
        text: currency,
      },
    },
    tooltip: {
      valueDecimals: 2,
    },
    legend: {
      enabled: false,
    },
    series: [
      {
        name: t('common.total'),
        colorByPoint: true,
        data: [principal, sumOfInterest, sumInstallments],
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export const LoanPrincipalOverTime = ({
  schedule,
}: {
  schedule: PaymentLogLike[];
}) => {
  const currency = useSettingsCurrency();
  const { t } = useLocalization();

  const actual: Array<[number, number]> = [];
  const simulated: Array<[number, number]> = [];

  for (const row of schedule) {
    const x = parseDateToUtcMs(row.date);
    const y = toNum(row.principal);
    const hasPaymentValues = toNum(row.reduction) != null || toNum(row.interest) != null;
    if (x == null || y == null || !hasPaymentValues) continue;
    if (row.was_payed === true) actual.push([x, y]);
    else simulated.push([x, y]);
  }

  const options = {
    chart: { type: 'line' },
    title: { text: t('loan.remainingPrincipal') },
    xAxis: { type: 'datetime' },
    yAxis: { min: 0, title: { text: currency } },
    tooltip: { valueDecimals: 2 },
    series: [
      { name: t('common.active'), data: actual },
      {
        name: t('common.pending'),
        data: simulated,
        dashStyle: 'ShortDash',
        opacity: 0.7,
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};

export const LoanAnnualBreakdown = ({
  annualSummaries,
  schedule,
}: {
  annualSummaries: Record<
    string,
    { total_principal: number; total_interest: number; total_fees: number }
  >;
  schedule: PaymentLogLike[];
}) => {
  const currency = useSettingsCurrency();
  const { t } = useLocalization();
  const locale = getLocale();

  const totalsByYear: Record<
    string,
    { principal: number; interest: number; fees: number }
  > = {};
  for (const y of Object.keys(annualSummaries ?? {})) {
    totalsByYear[y] = {
      principal: annualSummaries[y]?.total_principal ?? 0,
      interest: annualSummaries[y]?.total_interest ?? 0,
      fees: annualSummaries[y]?.total_fees ?? 0,
    };
  }

  const paidByYear: Record<
    string,
    { principal: number; interest: number; fees: number }
  > = {};

  for (const row of schedule ?? []) {
    if (!row || row.was_payed !== true) continue;
    const parts = (row.date ?? '').split('.');
    const year = parts.length === 3 ? parts[2]?.trim() : null;
    if (!year) continue;

    const principalPaid = toNum(row.reduction) ?? 0;
    const interestPaid = toNum(row.interest) ?? 0;
    const feesPaid = toNum((row as PaymentLogLike).fee) ?? 0;

    if (!paidByYear[year]) {
      paidByYear[year] = { principal: 0, interest: 0, fees: 0 };
    }
    paidByYear[year].principal += principalPaid;
    paidByYear[year].interest += interestPaid;
    paidByYear[year].fees += feesPaid;
  }

  // If some years exist only in actual payments (paidByYear) but not in annualSummaries,
  // treat their totals as "paid" (so we don't show 0 for past years).
  for (const y of Object.keys(paidByYear)) {
    if (!totalsByYear[y]) {
      totalsByYear[y] = {
        principal: paidByYear[y]?.principal ?? 0,
        interest: paidByYear[y]?.interest ?? 0,
        fees: 0,
      };
    }
  }

  const years = Array.from(
    new Set([...Object.keys(totalsByYear), ...Object.keys(paidByYear)])
  ).sort();

  const principalTotal = years.map((y) => totalsByYear[y]?.principal ?? 0);
  const interestTotal = years.map((y) => totalsByYear[y]?.interest ?? 0);
  const feesTotal = years.map((y) => totalsByYear[y]?.fees ?? 0);

  const principalPaid = years.map((y) => paidByYear[y]?.principal ?? 0);
  const interestPaid = years.map((y) => paidByYear[y]?.interest ?? 0);
  const feesPaid = years.map((y) => paidByYear[y]?.fees ?? 0);

  const principalRemaining = years.map((y, i) =>
    Math.max(0, (principalTotal[i] ?? 0) - (principalPaid[i] ?? 0))
  );
  const interestRemaining = years.map((y, i) =>
    Math.max(0, (interestTotal[i] ?? 0) - (interestPaid[i] ?? 0))
  );

  // Color palette: paid = stronger, remaining = softer (same hue)
  const COLORS = {
    principalPaid: 'rgba(124, 131, 255, 0.95)',
    principalRemaining: 'rgba(124, 131, 255, 0.45)',
    interestPaid: 'rgba(116, 227, 180, 0.95)',
    interestRemaining: 'rgba(116, 227, 180, 0.45)',
    feesPaid: 'rgba(255, 176, 86, 0.95)',
  } as const;

  const options = {
    chart: { type: 'column' },
    title: { text: t('loan.amortizationSchedule') },
    xAxis: { categories: years },
    yAxis: { min: 0, title: { text: currency }, stackLabels: { enabled: false } },
    tooltip: {
      shared: true,
      useHTML: true,
      formatter: function () {
        const ctx = this as unknown as { x: string | number; points?: any[] };
        const points = ctx.points ?? [];
        const firstPoint = points[0];
        const idx =
          typeof ctx.x === 'number'
            ? ctx.x
            : typeof firstPoint?.point?.x === 'number'
              ? firstPoint.point.x
              : null;
        const yearLabel =
          (firstPoint?.point?.category as string | undefined) ??
          (firstPoint?.key as string | undefined) ??
          (idx != null && years[idx] ? years[idx] : String(ctx.x));

        const principalPaidKey = `${t('loan.principal')} (${t('loan.paid')})`;
        const principalRemainingKey = `${t('loan.principal')} (${t('loan.remaining')})`;
        const interestPaidKey = `${t('loan.interests')} (${t('loan.paid')})`;
        const interestRemainingKey = `${t('loan.interests')} (${t('loan.remaining')})`;
        const feesPaidKey = `${t('loan.fees')} (${t('loan.paid')})`;

        const getY = (name: string): number => {
          const p = points.find((pt) => pt?.series?.name === name);
          const y = p?.y;
          return typeof y === 'number' && Number.isFinite(y) ? y : 0;
        };

        const principalPaidVal = getY(principalPaidKey);
        const principalRemainingVal = getY(principalRemainingKey);
        const interestPaidVal = getY(interestPaidKey);
        const interestRemainingVal = getY(interestRemainingKey);
        const feesPaidVal = getY(feesPaidKey);

        const principalTotalVal = principalPaidVal + principalRemainingVal;
        const interestTotalVal = interestPaidVal + interestRemainingVal;

        const fmt = (n: number) =>
          new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(n);

        const lines: string[] = [];
        lines.push(`<b>${yearLabel}</b>`);
        lines.push(
          `<div><b>${t('loan.principal')} total:</b> ${fmt(principalTotalVal)}</div>`
        );
        lines.push(
          `<div><b>${t('loan.interests')} total:</b> ${fmt(interestTotalVal)}</div>`
        );
        if (feesPaidVal > 0) {
          lines.push(
            `<div><b>${t('loan.fees')} ${t('loan.paid')}:</b> ${fmt(feesPaidVal)}</div>`
          );
        }

        // Smart: show Remaining only when it exists (use epsilon for rounding noise)
        const eps = 0.005;
        const showPrincipalBreakdown = principalRemainingVal > eps;
        const showInterestBreakdown = interestRemainingVal > eps;

        if (showPrincipalBreakdown || showInterestBreakdown) {
          lines.push('<div style="margin-top:6px"></div>');
        }

        // Only show Paid/Remaining breakdown when there is something remaining.
        // For fully-paid past years, totals already equal paid and showing paid again is redundant.
        if (showPrincipalBreakdown) {
          lines.push(
            `<div>${t('loan.principal')} ${t('loan.paid')}: ${fmt(principalPaidVal)}</div>`
          );
          lines.push(
            `<div>${t('loan.principal')} ${t('loan.remaining')}: ${fmt(principalRemainingVal)}</div>`
          );
        }
        if (showInterestBreakdown) {
          lines.push(
            `<div>${t('loan.interests')} ${t('loan.paid')}: ${fmt(interestPaidVal)}</div>`
          );
          lines.push(
            `<div>${t('loan.interests')} ${t('loan.remaining')}: ${fmt(interestRemainingVal)}</div>`
          );
        }

        return lines.join('');
      },
    },
    plotOptions: { column: { stacking: 'normal' } },
    series: [
      {
        name: `${t('loan.principal')} (${t('loan.paid')})`,
        data: principalPaid,
        color: COLORS.principalPaid,
      },
      {
        name: `${t('loan.principal')} (${t('loan.remaining')})`,
        data: principalRemaining,
        color: COLORS.principalRemaining,
      },
      {
        name: `${t('loan.interests')} (${t('loan.paid')})`,
        data: interestPaid,
        color: COLORS.interestPaid,
      },
      {
        name: `${t('loan.interests')} (${t('loan.remaining')})`,
        data: interestRemaining,
        color: COLORS.interestRemaining,
      },
      {
        name: `${t('loan.fees')} (${t('loan.paid')})`,
        data: feesPaid,
        color: COLORS.feesPaid,
      },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};
