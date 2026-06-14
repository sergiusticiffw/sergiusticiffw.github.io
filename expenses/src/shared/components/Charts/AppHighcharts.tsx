import HighchartsReact from 'highcharts-react-official';
import type { ComponentProps } from 'react';

type AppHighchartsProps = ComponentProps<typeof HighchartsReact>;

/** Highcharts wrapper — always recreate on option changes to avoid stock/update crashes. */
export default function AppHighcharts({
  immutable = true,
  ...props
}: AppHighchartsProps) {
  return <HighchartsReact immutable={immutable} {...props} />;
}
