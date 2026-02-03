import { useMemo, useCallback } from 'react';
import { useLocalization } from '@shared/context/localization';
import { formatMonthOption } from '@shared/utils/utils';

interface MonthOption {
  value: string;
  label: string;
}

interface UseMonthOptionsOptions {
  availableMonths: string[];
}

/**
 * Hook for formatting month options with user's language
 */
export const useMonthOptions = ({
  availableMonths,
}: UseMonthOptionsOptions) => {
  const { language } = useLocalization();

  const monthOptions = useMemo(() => {
    // Filter out invalid months and format valid ones
    return availableMonths
      .filter((month) => {
        // Basic validation: should be YYYY-MM format
        if (!month || typeof month !== 'string') return false;
        const parts = month.split('-');
        if (parts.length !== 2) return false;
        const year = parseInt(parts[0], 10);
        const monthNum = parseInt(parts[1], 10);
        return (
          !isNaN(year) &&
          !isNaN(monthNum) &&
          monthNum >= 1 &&
          monthNum <= 12 &&
          year >= 1900 &&
          year <= 2100
        );
      })
      .map((month) => formatMonthOption(month, language))
      .filter((option) => option.label !== '' && option.label !== option.value); // Filter out invalid formatted dates
  }, [availableMonths, language]);

  const getSelectedMonthLabel = useCallback(
    (selectedMonth: string): string => {
      if (!selectedMonth) return '';
      const month = monthOptions.find((m) => m.value === selectedMonth);
      return month?.label || selectedMonth;
    },
    [monthOptions]
  );

  return {
    monthOptions,
    getSelectedMonthLabel,
  };
};
