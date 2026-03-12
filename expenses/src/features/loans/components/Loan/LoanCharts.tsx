import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import Highcharts from 'highcharts/highstock';
import HighchartsReact from 'highcharts-react-official';

type PaymentLogLike = {
  date: string;
  principal: number | string;
  installment?: number | string;
  reduction: number | string;
  interest: number | string;
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
}: {
  annualSummaries: Record<
    string,
    { total_principal: number; total_interest: number; total_fees: number }
  >;
}) => {
  const currency = useSettingsCurrency();
  const { t } = useLocalization();

  const years = Object.keys(annualSummaries ?? {}).sort();
  const principal = years.map((y) => annualSummaries[y]?.total_principal ?? 0);
  const interest = years.map((y) => annualSummaries[y]?.total_interest ?? 0);
  const fees = years.map((y) => annualSummaries[y]?.total_fees ?? 0);

  const options = {
    chart: { type: 'column' },
    title: { text: t('loan.amortizationSchedule') },
    xAxis: { categories: years },
    yAxis: { min: 0, title: { text: currency }, stackLabels: { enabled: false } },
    tooltip: { shared: true, valueDecimals: 2 },
    plotOptions: { column: { stacking: 'normal' } },
    series: [
      { name: t('loan.principal'), data: principal },
      { name: t('loan.interests'), data: interest },
      { name: t('loan.fees'), data: fees },
    ],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
};
