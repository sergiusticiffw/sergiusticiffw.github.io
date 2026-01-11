import React, { useMemo, memo, useCallback } from 'react';
import { useLocalization } from '@context/localization';
import { useData } from '@context/context';
import { FiCalendar, FiSearch, FiX } from 'react-icons/fi';
import { useFilterFocus } from '@hooks/useFilterFocus';
import { useMonthFilter } from '@hooks/useMonthFilter';
import { formatMonthOption } from '@utils/utils';
import MonthChips from '@components/Common/MonthChips';
import { incomeSuggestions } from '@utils/constants';
import { hasTag } from '@utils/utils';
import './IncomeFilters.scss';

interface IncomeFiltersProps {
  textFilter: string;
  selectedMonth: string;
  selectedTag: string;
  onTextFilterChange: (value: string) => void;
  onMonthFilterChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

const IncomeFilters: React.FC<IncomeFiltersProps> = ({
  textFilter,
  selectedMonth,
  selectedTag,
  onTextFilterChange,
  onMonthFilterChange,
  onTagFilterChange,
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

  const hasActiveFilters = textFilter || selectedMonth || selectedTag;

  // Get available tags from income data
  const availableTags = useMemo(() => {
    if (!data.incomeData || data.incomeData.length === 0) {
      return [];
    }

    const tagsCount: Record<string, number> = {};
    data.incomeData.forEach((item: any) => {
      incomeSuggestions.forEach((tag) => {
        if (hasTag(item, tag)) {
          tagsCount[tag] = (tagsCount[tag] || 0) + 1;
        }
      });
    });

    return incomeSuggestions.filter((tag) => tagsCount[tag] > 0);
  }, [data.incomeData]);

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

  // Get selected tag label
  const selectedTagLabel = selectedTag
    ? t(`income.tags.${selectedTag}`) || selectedTag
    : '';

  // Handle tag click with selection handling
  const handleTagClick = useCallback(
    (tag: string) => {
      if (tag === selectedTag) {
        onTagFilterChange('');
      } else {
        onTagFilterChange(tag);
        handleSelection();
      }
    },
    [selectedTag, onTagFilterChange, handleSelection]
  );

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

        {/* Show selected tag as chip inside search - clickable to change */}
        {selectedTag && !isFilterFocused && (
          <div
            className="selected-tag-chip clickable"
            onClick={handleChipClick}
          >
            {selectedTagLabel}
          </div>
        )}

        <input
          type="text"
          value={textFilter}
          onChange={(e) => onTextFilterChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            (selectedMonth || selectedTag) && !isFilterFocused
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

      {/* Chips - Show when focused (both tags and months) */}
      {isFilterFocused && (
        <div className="filters-chips-container">
          {/* Tag Chips Section */}
          {availableTags.length > 0 && (
            <div className="chips-section">
              <div className="chips-section-title">
                {t('filters.tags') || 'Tags'}
              </div>
              <div className="tag-chips">
                <button
                  type="button"
                  onClick={() => handleTagClick('')}
                  className={`tag-chip ${!selectedTag ? 'selected' : ''}`}
                >
                  {t('filters.all') || 'All'}
                </button>
                {availableTags.map((tag) => {
                  const isSelected = selectedTag === tag;
                  const label = t(`income.tags.${tag}`) || tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      className={`tag-chip ${isSelected ? 'selected' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Month Chips Section */}
          <MonthChips
            months={availableMonths}
            selectedMonth={selectedMonth}
            onMonthClick={handleMonthClick}
            className="chips-section"
          />
        </div>
      )}
    </div>
  );
};

export default memo(IncomeFilters);
