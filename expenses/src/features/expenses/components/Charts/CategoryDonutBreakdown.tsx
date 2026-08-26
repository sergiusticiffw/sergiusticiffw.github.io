import { useMemo } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  buildCategoryDonutChartOptions,
  type CategoryChartPoint,
} from '@shared/utils/highchartsHelpers';
import { formatNumber } from '@shared/utils/utils';

type CategoryDonutBreakdownProps = {
  data: CategoryChartPoint[];
  currency: string;
};

export default function CategoryDonutBreakdown({
  data,
  currency,
}: CategoryDonutBreakdownProps) {
  const options = useMemo(
    () =>
      buildCategoryDonutChartOptions(data, currency, {
        formatNumber,
        height: 280,
      }),
    [data, currency]
  );

  if (!data.length) return null;

  return (
    <div className="pt-2">
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  );
}
