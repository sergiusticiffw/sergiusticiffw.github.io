import { useCallback } from 'react';

interface UseMonthFilterOptions {
  selectedMonth: string;
  onMonthChange: (value: string) => void;
  onSelection?: () => void;
}

/**
 * Hook for handling month filter selection logic
 */
export const useMonthFilter = ({
  selectedMonth,
  onMonthChange,
  onSelection,
}: UseMonthFilterOptions) => {
  const handleMonthClick = useCallback(
    (month: string) => {
      if (month === selectedMonth) {
        // Deselect
        onMonthChange('');
      } else {
        // Select
        onMonthChange(month);
      }
      // Close filter dropdown after selection
      onSelection?.();
    },
    [selectedMonth, onMonthChange, onSelection]
  );

  return {
    handleMonthClick,
  };
};

