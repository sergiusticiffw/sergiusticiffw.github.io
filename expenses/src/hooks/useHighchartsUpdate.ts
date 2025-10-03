import { useCallback } from 'react';
import { useHighchartsContext } from '@context/highcharts';

export const useHighchartsUpdate = () => {
  const { updateHighchartsConfig } = useHighchartsContext();

  const triggerUpdate = useCallback(() => {
    updateHighchartsConfig();
  }, [updateHighchartsConfig]);

  return { triggerUpdate };
};
