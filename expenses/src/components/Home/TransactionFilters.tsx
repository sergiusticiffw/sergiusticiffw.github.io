import React, { useMemo, useCallback } from 'react';
import { useLocalization } from '@context/localization';
import { useData } from '@context/context';
import { FiCalendar, FiSearch, FiX } from 'react-icons/fi';
import { useFilterFocus } from '@hooks/useFilterFocus';
import { useMonthOptions } from '@hooks/useMonthOptions';
import { useMonthFilter } from '@hooks/useMonthFilter';
import MonthChips from '@components/Common/MonthChips';
import { getSuggestions } from '@utils/constants';
import { getSuggestionTranslationKey, extractHashtags } from '@utils/utils';
import { normalizeTag } from '@hooks/useTags';
import { sanitizeText } from '@utils/sanitization';
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

    // Extract all unique tags from transaction descriptions
    const tagsCount: Record<string, number> = {};
    const allExtractedTags = new Set<string>();

    data.raw.forEach((item: any) => {
      if (item.type === 'transaction') {
        // Check both field_description and dsc fields
        const description = item.field_description || item.dsc || '';
        if (description) {
          const tags = extractHashtags(description);
          tags.forEach((tag) => {
            allExtractedTags.add(tag);
            tagsCount[tag] = (tagsCount[tag] || 0) + 1;
          });
        }
      }
    });

    // Get all suggestions from all categories for translation purposes
    const allSuggestions = new Set<string>();
    const suggestionsMap = getSuggestions();
    Object.values(suggestionsMap).forEach((suggestions) => {
      suggestions.forEach((suggestion) => {
        allSuggestions.add(suggestion);
      });
    });

    // Combine extracted tags with suggestions (for proper translation)
    // Return tags sorted by count (most used first)
    return Array.from(allExtractedTags).sort(
      (a, b) => (tagsCount[b] || 0) - (tagsCount[a] || 0)
    );
  }, [data.raw]);

  // Helper function to find the original suggestion from a normalized tag
  const findOriginalSuggestion = (
    normalizedTag: string
  ): { suggestion: string; category: string } | null => {
    const suggestionsMap = getSuggestions();
    for (const [category, suggestions] of Object.entries(suggestionsMap)) {
      for (const suggestion of suggestions) {
        if (normalizeTag(suggestion) === normalizedTag) {
          return { suggestion, category };
        }
      }
    }
    return null;
  };

  // Get selected tag label
  const selectedTagLabel = selectedTag
    ? (() => {
        // Try to find original suggestion from normalized tag
        const original = findOriginalSuggestion(selectedTag);
        if (original) {
          const translationKey = getSuggestionTranslationKey(
            original.suggestion,
            original.category
          );
          return t(translationKey) !== translationKey
            ? t(translationKey)
            : original.suggestion;
        }
        // If not found, try to convert cratime to spaces for display
        return selectedTag.replace(/-/g, ' ');
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
          onChange={(e) => {
            // Sanitize search input before updating state
            const sanitizedValue = sanitizeText(e.target.value);
            onSearchChange(sanitizedValue);
          }}
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
                  // Find original suggestion from normalized tag for translation
                  const original = findOriginalSuggestion(tag);
                  let label = tag;
                  if (original) {
                    const translationKey = getSuggestionTranslationKey(
                      original.suggestion,
                      original.category
                    );
                    label =
                      t(translationKey) !== translationKey
                        ? t(translationKey)
                        : original.suggestion;
                  } else {
                    // If not found in suggestions, convert cratime to spaces for display
                    label = tag.replace(/-/g, ' ');
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
