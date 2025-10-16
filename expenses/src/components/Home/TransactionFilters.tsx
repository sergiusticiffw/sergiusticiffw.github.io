import React, { useState, useMemo } from 'react';
import { useLocalization } from '@context/localization';
import { FaCalendar, FaSearch, FaTimes } from 'react-icons/fa';
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
  const [isFilterFocused, setIsFilterFocused] = useState(false);

  const handleCategoryClick = (value: string) => {
    if (value === categoryValue) {
      onCategoryChange('');
    } else {
      onCategoryChange(value);
      setIsFilterFocused(false);
    }
  };

  const handleMonthClick = (month: string) => {
    if (month === selectedMonth) {
      onMonthChange('');
    } else {
      onMonthChange(month);
      setIsFilterFocused(false);
    }
  };

  const hasFilters = searchValue || categoryValue || selectedMonth;

  // Filter out "All categories" option
  const categoryChips = categories.filter((cat) => cat.value !== '');

  // Get selected category label
  const selectedCategoryLabel = categoryValue
    ? categories.find((cat) => cat.value === categoryValue)?.label
    : '';

  // Generate month options with labels
  const monthOptions = useMemo(() => {
    return availableMonths.map((month) => {
      const date = new Date(month + '-01');
      const label = date.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      return { value: month, label };
    });
  }, [availableMonths]);

  // Get selected month label
  const selectedMonthLabel = selectedMonth
    ? monthOptions.find((m) => m.value === selectedMonth)?.label || selectedMonth
    : '';

  return (
    <div className="transaction-filters-combined">
      {/* Combined Search Input */}
      <div className="search-bar-component">
        <FaSearch className="search-bar-icon" />

        {/* Show selected month as chip inside search */}
        {selectedMonth && !isFilterFocused && (
          <div
            className="selected-month-chip clickable"
            onClick={() => setIsFilterFocused(true)}
          >
            <FaCalendar />
            {selectedMonthLabel}
          </div>
        )}

        {/* Show selected category as chip */}
        {categoryValue && !isFilterFocused && (
          <div
            className="selected-category-chip clickable"
            onClick={() => setIsFilterFocused(true)}
          >
            {selectedCategoryLabel}
          </div>
        )}

        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setIsFilterFocused(true)}
          onBlur={() => {
            setTimeout(() => setIsFilterFocused(false), 200);
          }}
          placeholder={
            selectedMonth || categoryValue
              ? 'Search in month/category...'
              : t('filters.search') || 'Search or filter...'
          }
          className="search-bar-input"
        />

        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="clear-filters-btn"
            title="Clear all filters"
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
                {t('filters.categories') || 'Categories'}
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
          {monthOptions.length > 0 && (
            <div className="chips-section">
              <div className="chips-section-title">
                <FaCalendar />
                {t('filters.months') || 'Months'}
              </div>
              <div className="month-chips">
                {monthOptions.map((month) => (
                  <button
                    key={month.value}
                    onClick={() => handleMonthClick(month.value)}
                    className={`month-chip ${month.value === selectedMonth ? 'active' : ''}`}
                  >
                    {month.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TransactionFilters;

