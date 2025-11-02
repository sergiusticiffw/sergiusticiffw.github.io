import React, { useMemo, useCallback } from 'react';
import { useLocalization } from '@context/localization';
import { FaCalendar, FaSearch, FaTimes } from 'react-icons/fa';
import { useFilterFocus } from '@hooks/useFilterFocus';
import { useMonthOptions } from '@hooks/useMonthOptions';
import { useMonthFilter } from '@hooks/useMonthFilter';
import MonthChips from '@components/Common/MonthChips';
import './TransactionFilters.scss';

interface TransactionFiltersProps {
  searchValue: string;
  categoryValue: string;
  selectedMonth: string;
  categories: Array<{ value: string; label: string }>;
  availableMonths: string[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onClearFilters: () => void;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  searchValue,
  categoryValue,
  selectedMonth,
  categories,
  availableMonths,
  onSearchChange,
  onCategoryChange,
  onMonthChange,
  onClearFilters,
}) => {
  const { t } = useLocalization();
  
  // Use reusable hooks
  const {
    isFilterFocused,
    handleFocus,
    handleBlur,
    handleChipClick,
    handleSelection,
  } = useFilterFocus();

  const { monthOptions, getSelectedMonthLabel } = useMonthOptions({
    availableMonths,
  });

  const { handleMonthClick } = useMonthFilter({
    selectedMonth,
    onMonthChange,
    onSelection: handleSelection,
  });

  const handleCategoryClick = useCallback((value: string) => {
    if (value === categoryValue) {
      onCategoryChange('');
    } else {
      onCategoryChange(value);
      handleSelection();
    }
  }, [categoryValue, onCategoryChange, handleSelection]);

  const hasFilters = searchValue || categoryValue || selectedMonth;

  // Filter out "All categories" option
  const categoryChips = categories.filter((cat) => cat.value !== '');

  // Get selected category label
  const selectedCategoryLabel = categoryValue
    ? categories.find((cat) => cat.value === categoryValue)?.label
    : '';

  // Get selected month label
  const selectedMonthLabel = getSelectedMonthLabel(selectedMonth);

  return (
    <div className="transaction-filters-combined">
      {/* Combined Search Input */}
      <div className="search-bar-component">
        <FaSearch className="search-bar-icon" />

        {/* Show selected month as chip inside search */}
        {selectedMonth && !isFilterFocused && (
          <div
            className="selected-month-chip clickable"
            onClick={handleChipClick}
          >
            <FaCalendar />
            {selectedMonthLabel}
          </div>
        )}

        {/* Show selected category as chip */}
        {categoryValue && !isFilterFocused && (
          <div
            className="selected-category-chip clickable"
            onClick={handleChipClick}
          >
            {selectedCategoryLabel}
          </div>
        )}

        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            selectedMonth || categoryValue
              ? t('filters.searchInMonthCategory')
              : t('filters.search')
          }
          className="search-bar-input"
        />

        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="clear-filters-btn"
            title={t('filters.clearAll')}
          >
            <FaTimes />
          </button>
        )}
      </div>

      {/* Chips - Show when focused (both categories and months) */}
      {isFilterFocused && (
        <div className="filters-chips-container">
          {/* Category Chips Section */}
          {categoryChips.length > 0 && (
            <div className="chips-section">
              <div className="chips-section-title">
                {t('filters.categories')}
              </div>
              <div className="category-chips">
                {categoryChips.map((category) => (
                  <button
                    key={category.value}
                    onClick={() => handleCategoryClick(category.value)}
                    className={`category-chip ${category.value === categoryValue ? 'active' : ''}`}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Month Chips Section */}
          <MonthChips
            months={monthOptions}
            selectedMonth={selectedMonth}
            onMonthClick={handleMonthClick}
            className="chips-section"
          />
        </div>
      )}
    </div>
  );
};

export default React.memo(TransactionFilters);

