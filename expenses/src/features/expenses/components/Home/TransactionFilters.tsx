import React, { useMemo, useCallback } from 'react';
import { useLocalization } from '@shared/context/localization';
import { useExpenseData } from '@stores/expenseStore';
import { FiCalendar, FiGrid, FiSearch, FiTag, FiX } from 'react-icons/fi';
import { useFilterFocus } from '@shared/hooks/useFilterFocus';
import { useMonthOptions } from '@shared/hooks/useMonthOptions';
import { useMonthFilter } from '@shared/hooks/useMonthFilter';
import MonthChips from '@shared/components/Common/MonthChips';
import { getSuggestions } from '@shared/utils/constants';
import {
  getSuggestionTranslationKey,
  extractHashtags,
} from '@shared/utils/utils';
import { normalizeTag } from '@shared/hooks/useTags';
import { sanitizeText } from '@shared/utils/sanitization';
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
  showMonthFilter: _showMonthFilter = true,
}) => {
  const { t } = useLocalization();
  const { data } = useExpenseData();

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

  const searchBar =
    'flex items-center bg-white/[0.05] rounded-2xl px-4 gap-3 w-full transition-all duration-200 focus-within:bg-white/[0.08] focus-within:ring-2 focus-within:ring-white/20 focus-within:ring-inset border border-white/[0.08] focus-within:border-white/20';
  const chipBase =
    'flex items-center gap-1.5 text-xs font-medium py-2 px-3 rounded-2xl whitespace-nowrap shrink-0 cursor-pointer transition-all duration-200 border border-white/20';
  const monthChip =
    'bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] text-white [&_svg]:text-[0.75rem] hover:from-[#6b9dff] hover:to-[#5a8dec] hover:scale-[1.02] active:scale-[0.98]';
  const categoryChip =
    'bg-gradient-to-br from-[#ff6b9d] to-[#ee5a8c] text-white hover:from-[#ff7bad] hover:to-[#fe6a9c] hover:scale-[1.02] active:scale-[0.98]';
  const tagChipStyle =
    'bg-gradient-to-br from-[#9b59b6] to-[#8a48a5] text-white hover:from-[#ab69c6] hover:to-[#9a58b5] hover:scale-[1.02] active:scale-[0.98]';
  const chipActive =
    'rounded-[20px] py-2 px-4 text-sm cursor-pointer transition-all border bg-gradient-to-br from-[#5b8def] to-[#4a7ddc] border-transparent text-white font-medium shadow-[0_2px_8px_rgba(91,141,239,0.3)] hover:shadow-[0_2px_12px_rgba(91,141,239,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80';
  const chipInactive =
    'rounded-[20px] py-2 px-4 text-sm cursor-pointer transition-all border bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80';
  const tagChipSelected =
    'rounded-[20px] py-2 px-4 text-sm cursor-pointer transition-all border bg-gradient-to-br from-[#9b59b6] to-[#8a48a5] border-transparent text-white font-medium shadow-[0_2px_8px_rgba(155,89,182,0.3)] hover:shadow-[0_2px_12px_rgba(155,89,182,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80';

  return (
    <div className="w-full flex flex-col gap-3 mb-6 overflow-x-hidden max-w-full" role="search">
      <div className={searchBar}>
        <FiSearch className="text-white/40 text-lg shrink-0" aria-hidden />

        {selectedMonth && !isFilterFocused && (
          <div
            className={`${chipBase} ${monthChip}`}
            onClick={handleChipClick}
            onKeyDown={(e) => e.key === 'Enter' && handleChipClick()}
            role="button"
            tabIndex={0}
            aria-label={selectedMonthLabel}
          >
            <FiCalendar aria-hidden />
            {selectedMonthLabel}
          </div>
        )}

        {categoryValue && !isFilterFocused && (
          <div
            className={`${chipBase} ${categoryChip}`}
            onClick={handleChipClick}
            onKeyDown={(e) => e.key === 'Enter' && handleChipClick()}
            role="button"
            tabIndex={0}
            aria-label={selectedCategoryLabel}
          >
            {selectedCategoryLabel}
          </div>
        )}

        {selectedTag && !isFilterFocused && (
          <div
            className={`${chipBase} ${tagChipStyle}`}
            onClick={handleChipClick}
            onKeyDown={(e) => e.key === 'Enter' && handleChipClick()}
            role="button"
            tabIndex={0}
            aria-label={selectedTagLabel}
          >
            {selectedTagLabel}
          </div>
        )}

        <input
          type="search"
          value={searchValue}
          onChange={(e) => {
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
          className="flex-1 bg-transparent border-none py-4 text-white text-[0.95rem] outline-none min-w-0 placeholder:text-white/40 focus:outline-none"
          aria-label={t('filters.search')}
          autoComplete="off"
        />

        {hasFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="flex items-center gap-1.5 shrink-0 py-2 px-3 rounded-xl border border-transparent text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80"
            title={t('filters.clearAll')}
            aria-label={t('filters.clearAll')}
          >
            <FiX className="text-lg" aria-hidden />
            <span className="text-xs font-medium hidden sm:inline">{t('filters.clear')}</span>
          </button>
        )}
      </div>

      {isFilterFocused && (
        <div
          className="transaction-filters-expanded flex flex-col gap-5 min-h-0 max-h-[min(400px,60vh)] overflow-x-hidden w-full max-w-full overflow-y-auto py-3 px-4 rounded-xl border border-white/[0.08] bg-white/[0.03] animate-[slideDown_0.2s_ease-out] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/[0.05] [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
          role="region"
          aria-label={t('filters.categories')}
        >
          {categoryChips.length > 0 && (
            <div className="flex flex-col gap-3 flex-shrink-0">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 [&_svg]:text-sm shrink-0">
                <FiGrid aria-hidden />
                {t('filters.categories')}
              </div>
              <div className="flex flex-wrap gap-2 overflow-x-hidden w-full max-w-full">
                {categoryChips.map((category) => (
                  <button
                    key={category.value}
                    type="button"
                    onClick={() => handleCategoryClick(category.value)}
                    className={category.value === categoryValue ? chipActive : chipInactive}
                    aria-pressed={category.value === categoryValue}
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {availableTags.length > 0 && (
            <div className="flex flex-col gap-3 flex-shrink-0">
              <div className="text-white/50 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 [&_svg]:text-sm shrink-0">
                <FiTag aria-hidden />
                {t('filters.tags') || 'Tags'}
              </div>
              <div className="flex flex-wrap gap-2 overflow-x-hidden w-full max-w-full">
                <button
                  type="button"
                  onClick={() => handleTagClick('')}
                  className={!selectedTag ? tagChipSelected : chipInactive}
                  aria-pressed={!selectedTag}
                >
                  {t('filters.all') || 'All'}
                </button>
                {availableTags.map((tag) => {
                  const isSelected = selectedTag === tag;
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
                    label = tag.replace(/-/g, ' ');
                  }
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      className={isSelected ? tagChipSelected : chipInactive}
                      aria-pressed={isSelected}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-shrink-0">
            <MonthChips
              months={monthOptions}
              selectedMonth={selectedMonth}
              onMonthClick={handleMonthClick}
              className="flex flex-col gap-3 mt-0"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(TransactionFilters);
