import React, { useMemo, memo } from 'react';
import { useLocalization } from '@context/localization';
import { useData } from '@context/context';
import { FiCalendar, FiSearch, FiX } from 'react-icons/fi';
import { useFilterFocus } from '@hooks/useFilterFocus';
import { useMonthFilter } from '@hooks/useMonthFilter';
import { formatMonthOption } from '@utils/utils';
import MonthChips from '@components/Common/MonthChips';
import './IncomeFilters.scss';

interface IncomeFiltersProps {
  textFilter: string;
  selectedMonth: string;
  onTextFilterChange: (value: string) => void;
  onMonthFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

const IncomeFilters: React.FC<IncomeFiltersProps> = ({
  textFilter,
  selectedMonth,
  onTextFilterChange,
  onMonthFilterChange,
  onClearFilters,
}) => {
  const { t, language } = useLocalization();
  const { data } = useData();

  // Use reusable hooks
  const {
    isFilterFocused,
    handleFocus,
    handleBlur,
    handleChipClick,
    handleSelection,
  } = useFilterFocus();

  const { handleMonthClick } = useMonthFilter({
    selectedMonth,
    onMonthChange: onMonthFilterChange,
    onSelection: handleSelection,
  });

  const hasActiveFilters = textFilter || selectedMonth;

  // Generate list of available months from actual income data
  const availableMonths = useMemo(() => {
    if (!data.incomeData || data.incomeData.length === 0) {
      return [];
    }

    // Extract unique months from income data with validation
    const monthsSet = new Set<string>();
    data.incomeData.forEach((item: any) => {
      if (!item.dt) return; // Skip invalid dates
      const date = new Date(item.dt);
      // Validate date is valid
      if (isNaN(date.getTime())) return;
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const monthValue = `${year}-${month}`;
      // Additional validation: year should be reasonable (1900-2100)
      if (year >= 1900 && year <= 2100) {
        monthsSet.add(monthValue);
      }
    });

    // Convert to array and sort descending (newest first)
    const monthsArray = Array.from(monthsSet).sort((a, b) =>
      b.localeCompare(a)
    );

    // Format for display using reusable utility, filter out invalid dates
    return monthsArray
      .map((monthValue) => formatMonthOption(monthValue, language))
      .filter((option) => option.label !== '' && option.label !== option.value); // Filter out invalid formatted dates
  }, [data.incomeData, language]);

  // Get selected month label
  const selectedMonthLabel = selectedMonth
    ? availableMonths.find((m) => m.value === selectedMonth)?.label
    : '';

  return (
    <div className="income-filters-combined">
      {/* Combined Search Input */}
      <div className="search-bar-component">
        <FiSearch className="search-bar-icon" />

        {/* Show selected month as chip inside search - clickable to change */}
        {selectedMonth && !isFilterFocused && (
          <div
            className="selected-month-chip clickable"
            onClick={handleChipClick}
          >
            <FiCalendar />
            {selectedMonthLabel}
          </div>
        )}

        <input
          type="text"
          value={textFilter}
          onChange={(e) => onTextFilterChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            selectedMonth && !isFilterFocused
              ? t('filters.searchInMonth')
              : t('filters.search')
          }
          className="search-bar-input"
        />

        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="clear-filters-btn"
            title={t('filters.clearAll')}
          >
            <FiX />
          </button>
        )}
      </div>

      {/* Month Chips - Show when focused (to select or change month) */}
      {isFilterFocused && (
        <MonthChips
          months={availableMonths}
          selectedMonth={selectedMonth}
          onMonthClick={handleMonthClick}
        />
      )}
    </div>
  );
};

export default memo(IncomeFilters);
