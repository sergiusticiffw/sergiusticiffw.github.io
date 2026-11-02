import React, { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useChartsThemeSync } from '@shared/context/highcharts';
import { useLocalization } from '@shared/context/localization';
import { AiChartSpec, parseChartSpec } from '../../../ai/chartSpec';

const toOptions = (spec: AiChartSpec, fallbackTitle: string): Highcharts.Options => {
  const title = spec.title || fallbackTitle;
  const common: Highcharts.Options = {
    chart: {
      backgroundColor: 'transparent',
      height: 260,
      style: { fontFamily: 'inherit' },
    },
    title: {
      text: title,
      style: { fontSize: '13px', fontWeight: '600' },
    },
    credits: { enabled: false },
    legend: {
      enabled: (spec.series?.length || 0) > 1 || spec.type === 'pie',
      itemStyle: { fontSize: '11px' },
    },
    tooltip: { shared: spec.type !== 'pie' },
  };

  if (spec.type === 'pie') {
    return {
      ...common,
      chart: { ...common.chart, type: 'pie' },
      plotOptions: {
        pie: {
          allowPointSelect: false,
          dataLabels: {
            enabled: true,
            format: '{point.name}: {point.percentage:.0f}%',
            style: { fontSize: '11px', textOutline: 'none' },
          },
        },
      },
      series: [
        {
          type: 'pie',
          name: spec.unit || title,
          data: (spec.data || []).map((row) => ({ name: row.name, y: row.y })),
        },
      ],
    };
  }

  return {
    ...common,
    chart: { ...common.chart, type: spec.type },
    xAxis: {
      categories: spec.categories,
      labels: { style: { fontSize: '10px' } },
    },
    yAxis: {
      title: { text: spec.unit || undefined },
      labels: { style: { fontSize: '10px' } },
      softMin: 0,
    },
    plotOptions: {
      column: { borderWidth: 0, groupPadding: 0.08 },
      bar: { borderWidth: 0 },
      line: { marker: { radius: 3 } },
    },
    series: (spec.series || []).map((entry) => ({
      type: spec.type,
      name: entry.name,
      data: entry.data,
    })),
  };
};

const AiChart: React.FC<{ raw: string }> = ({ raw }) => {
  const { t } = useLocalization();
  useChartsThemeSync();
  const spec = useMemo(() => parseChartSpec(raw), [raw]);
  const options = useMemo(
    () => (spec ? toOptions(spec, t('assistant.chartTitle')) : null),
    [spec, t]
  );

  if (!options) {
    return (
      <p className="my-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-app-muted">
        {t('assistant.chartInvalid')}
      </p>
    );
  }

  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] px-1 pt-1 pb-0">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
};

export default React.memo(AiChart);
