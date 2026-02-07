import React, { useMemo, memo, useCallback } from 'react';
import { useLocalization } from '@shared/context/localization';
import { useExpenseData } from '@stores/expenseStore';
import { FiCalendar, FiSearch, FiTag, FiX } from 'react-icons/fi';
import { useFilterFocus, nudgeViewportForFixedRepaint } from '@shared/hooks/useFilterFocus';
import { useMonthFilter } from '@shared/hooks/useMonthFilter';
import { formatMonthOption } from '@shared/utils/utils';
import MonthChips from '@shared/components/Common/MonthChips';
import { incomeSuggestions } from '@shared/utils/constants';
import { hasTag } from '@shared/utils/utils';

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
  const { data } = useExpenseData();

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

  const searchBar =
    'flex items-center bg-white/[0.05] rounded-2xl px-4 gap-3 w-full transition-all duration-200 focus-within:bg-white/[0.08] focus-within:ring-2 focus-within:ring-white/20 focus-within:ring-inset border border-white/[0.08] focus-within:border-white/20';
  const chipBase =
    'flex items-center gap-1.5 text-xs font-medium py-2 px-3 rounded-2xl whitespace-nowrap shrink-0 cursor-pointer transition-all duration-200 border border-white/20 bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-white [&_svg]:text-[0.75rem] hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]';
  const chipInactive =
    'rounded-[20px] py-2 px-4 text-sm cursor-pointer transition-all border bg-white/[0.05] border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80';
  const chipSelected =
    'rounded-[20px] py-2 px-4 text-sm cursor-pointer transition-all border bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] border-transparent text-white font-medium shadow-[0_2px_8px_var(--color-app-accent-shadow)] hover:shadow-[0_2px_12px_var(--color-app-accent-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black/80';

  return (
    <div className="w-full flex flex-col gap-3 mb-6 overflow-x-hidden max-w-full" role="search">
      <div className={searchBar}>
        <FiSearch className="text-white/40 text-lg shrink-0" aria-hidden />

        {selectedMonth && !isFilterFocused && (
          <div
            className={chipBase}
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

        {selectedTag && !isFilterFocused && (
          <div
            className={chipBase}
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
          value={textFilter}
          onChange={(e) => onTextFilterChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={
            (selectedMonth || selectedTag) && !isFilterFocused
              ? t('filters.searchInMonth')
              : t('filters.search')
          }
          className="flex-1 bg-transparent border-none py-4 text-white text-[0.95rem] outline-none min-w-0 placeholder:text-white/40 focus:outline-none"
          aria-label={t('filters.search')}
          autoComplete="off"
        />

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              onClearFilters();
              nudgeViewportForFixedRepaint();
            }}
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
          className="flex flex-col gap-5 min-h-0 max-h-[min(400px,60vh)] overflow-x-hidden w-full max-w-full overflow-y-auto py-3 px-4 rounded-xl border border-white/[0.08] bg-white/[0.03] animate-[slideDown_0.2s_ease-out] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/[0.05] [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
          role="region"
          aria-label={t('filters.tags')}
        >
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
                  className={!selectedTag ? chipSelected : chipInactive}
                  aria-pressed={!selectedTag}
                >
                  {t('filters.all') || 'All'}
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagClick(tag)}
                    className={selectedTag === tag ? chipSelected : chipInactive}
                    aria-pressed={selectedTag === tag}
                  >
                    {t(`income.tags.${tag}`) || tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-shrink-0">
            <MonthChips
              months={availableMonths}
              selectedMonth={selectedMonth}
              onMonthClick={handleMonthClick}
              className="flex flex-col gap-3 max-h-[200px] overflow-y-auto overflow-x-hidden w-full max-w-full [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/[0.05] [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(IncomeFilters);
