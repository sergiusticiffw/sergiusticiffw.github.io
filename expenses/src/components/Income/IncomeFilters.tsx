import React, { useState, useEffect, useMemo } from 'react';
import { useLocalization } from '@context/localization';
import { useData } from '@context/context';
import { FaCalendar, FaSearch, FaTimes } from 'react-icons/fa';
import { formatMonthOption } from '@utils/utils';
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
  const [isFilterFocused, setIsFilterFocused] = useState(false);

  const handleTextFilterChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onTextFilterChange(event.target.value);
  };

  const handleMonthClick = (month: string) => {
    if (month === selectedMonth) {
      // Deselect
      onMonthFilterChange('');
    } else {
      // Select
      onMonthFilterChange(month);
      setIsFilterFocused(false); // Hide month list after selection
    }
  };

  const hasActiveFilters = textFilter || selectedMonth;

  // Generate list of available months from actual income data
  const availableMonths = useMemo(() => {
    if (!data.incomeData || data.incomeData.length === 0) {
      return [];
    }

    // Extract unique months from income data
    const monthsSet = new Set<string>();
    data.incomeData.forEach((item: any) => {
      const date = new Date(item.dt);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const monthValue = `${year}-${month}`;
      monthsSet.add(monthValue);
    });

    // Convert to array and sort descending (newest first)
    const monthsArray = Array.from(monthsSet).sort((a, b) => b.localeCompare(a));

    // Format for display using reusable utility
    return monthsArray.map((monthValue) => formatMonthOption(monthValue, language));
  }, [data.incomeData, language]);

  // Get selected month label
  const selectedMonthLabel = selectedMonth
    ? availableMonths.find((m) => m.value === selectedMonth)?.label
    : '';

  // Build display text
  const displayText = selectedMonthLabel
    ? textFilter
      ? `${selectedMonthLabel}: ${textFilter}`
      : selectedMonthLabel
    : textFilter;

  return (
    <div className="income-filters-combined">
      {/* Combined Search Input */}
      <div className="search-bar-component">
        <FaSearch className="search-bar-icon" />

        {/* Show selected month as chip inside search - clickable to change */}
        {selectedMonth && !isFilterFocused && (
          <div
            className="selected-month-chip clickable"
            onClick={() => setIsFilterFocused(true)}
          >
            <FaCalendar />
            {selectedMonthLabel}
          </div>
        )}

        <input
          type="text"
          value={textFilter}
          onChange={handleTextFilterChange}
          onFocus={() => setIsFilterFocused(true)}
          onBlur={() => {
            // Delay to allow chip click
            setTimeout(() => setIsFilterFocused(false), 200);
          }}
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
            <FaTimes />
          </button>
        )}
      </div>

      {/* Month Chips - Show when focused (to select or change month) */}
      {isFilterFocused && (
        <div className="month-chips">
          {availableMonths.map((month) => (
            <button
              key={month.value}
              onClick={() => handleMonthClick(month.value)}
              className={`month-chip ${month.value === selectedMonth ? 'active' : ''}`}
            >
              {month.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncomeFilters;
