import React, { useMemo, useCallback } from 'react';
import { useLocalization } from '@context/localization';
import { useData } from '@context/context';
import { FiCalendar, FiSearch, FiX } from 'react-icons/fi';
import { useFilterFocus } from '@hooks/useFilterFocus';
import { useMonthOptions } from '@hooks/useMonthOptions';
import { useMonthFilter } from '@hooks/useMonthFilter';
import MonthChips from '@components/Common/MonthChips';
import { getSuggestions } from '@utils/constants';
import { hasTag, getSuggestionTranslationKey } from '@utils/utils';
import './TransactionFilters.scss';

interface TransactionFiltersProps {
  searchValue: string;
  categoryValue: string;
  selectedMonth: string;
  selectedTag: string;
  categories: Array<{ value: string; label: string }>;
  availableMonths: string[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onTagChange: (value: string) => void;
  onClearFilters: () => void;
  showMonthFilter?: boolean; // Control whether month filter is displayed
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({
  searchValue,
  categoryValue,
  selectedMonth,
  selectedTag,
  categories,
  availableMonths,
  onSearchChange,
  onCategoryChange,
  onMonthChange,
  onTagChange,
  onClearFilters,
  showMonthFilter = true, // Default to true for backward compatibility
}) => {
  const { t } = useLocalization();
  const { data } = useData();

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

  const handleCategoryClick = useCallback(
    (value: string) => {
      if (value === categoryValue) {
        onCategoryChange('');
      } else {
        onCategoryChange(value);
        handleSelection();
      }
    },
    [categoryValue, onCategoryChange, handleSelection]
  );

  const hasFilters =
    searchValue || categoryValue || selectedMonth || selectedTag;

  // Get all available tags from transaction data
  const availableTags = useMemo(() => {
    if (!data.raw || data.raw.length === 0) {
      return [];
    }

    // Get all suggestions from all categories
    const allSuggestions = new Set<string>();
    const suggestionsMap = getSuggestions();
    Object.values(suggestionsMap).forEach((suggestions) => {
      suggestions.forEach((suggestion) => {
        allSuggestions.add(suggestion);
      });
    });

    // Count tags in transaction data
    const tagsCount: Record<string, number> = {};
    data.raw.forEach((item: any) => {
      if (item.type === 'transaction') {
        allSuggestions.forEach((tag) => {
          if (hasTag(item, tag)) {
            tagsCount[tag] = (tagsCount[tag] || 0) + 1;
          }
        });
      }
    });

    // Return tags that exist in data, sorted by count (most used first)
    return Array.from(allSuggestions)
      .filter((tag) => tagsCount[tag] > 0)
      .sort((a, b) => (tagsCount[b] || 0) - (tagsCount[a] || 0));
  }, [data.raw]);

  // Get selected tag label
  const selectedTagLabel = selectedTag
    ? (() => {
        // Find which category this tag belongs to
        const suggestionsMap = getSuggestions();
        for (const [category, suggestions] of Object.entries(suggestionsMap)) {
          if (suggestions.includes(selectedTag)) {
            const translationKey = getSuggestionTranslationKey(
              selectedTag,
              category
            );
            return t(translationKey) !== translationKey
              ? t(translationKey)
              : selectedTag;
          }
        }
        return selectedTag;
      })()
    : '';

  // Handle tag click with selection handling
  const handleTagClick = useCallback(
    (tag: string) => {
      if (tag === selectedTag) {
        onTagChange('');
      } else {
        onTagChange(tag);
        handleSelection();
      }
    },
    [selectedTag, onTagChange, handleSelection]
  );

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
        <FiSearch className="search-bar-icon" />

        {/* Show selected month as chip inside search */}
        {selectedMonth && !isFilterFocused && (
          <div
            className="selected-month-chip clickable"
            onClick={handleChipClick}
          >
            <FiCalendar />
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

        {/* Show selected tag as chip */}
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
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            selectedMonth || categoryValue || selectedTag
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
            <FiX />
          </button>
        )}
      </div>

      {/* Chips - Show when focused (both categories, tags and months) */}
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
                  // Find which category this tag belongs to for translation
                  const suggestionsMap = getSuggestions();
                  let label = tag;
                  for (const [category, suggestions] of Object.entries(
                    suggestionsMap
                  )) {
                    if (suggestions.includes(tag)) {
                      const translationKey = getSuggestionTranslationKey(
                        tag,
                        category
                      );
                      label =
                        t(translationKey) !== translationKey
                          ? t(translationKey)
                          : tag;
                      break;
                    }
                  }
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
