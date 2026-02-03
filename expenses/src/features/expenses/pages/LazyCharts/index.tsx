import { HighchartsProvider } from '@shared/context/highcharts';
import Charts from '@features/expenses/pages/Charts';

/** HighchartsProvider only on charts route – no global init. */
export default function LazyCharts() {
  return (
    <HighchartsProvider>
      <Charts />
    </HighchartsProvider>
  );
}
