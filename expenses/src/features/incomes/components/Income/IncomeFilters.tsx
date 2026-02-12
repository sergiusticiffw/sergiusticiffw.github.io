import React, { useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { useLocalization } from '@shared/context/localization';
import { useExpenseData } from '@stores/expenseStore';
import { FiCalendar, FiSearch, FiTag, FiX } from 'react-icons/fi';
import { useFilterFocus } from '@shared/hooks/useFilterFocus';
import { useMonthFilter } from '@shared/hooks/useMonthFilter';
import { formatMonthOption } from '@shared/utils/utils';
import MonthChips from '@shared/components/Common/MonthChips';
import { incomeSuggestions } from '@shared/utils/constants';
import { hasTag } from '@shared/utils/utils';

export type DateRangeValue = { start: string; end: string } | null;

interface IncomeFiltersProps {
  textFilter: string;
  selectedMonth: string;
  selectedTag: string;
  dateRange: DateRangeValue;
  onTextFilterChange: (value: string) => void;
  onMonthFilterChange: (value: string) => void;
  onTagFilterChange: (value: string) => void;
  onDateRangeChange: (value: DateRangeValue) => void;
  onClearFilters: () => void;
}

const IncomeFilters: React.FC<IncomeFiltersProps> = ({
  textFilter,
  selectedMonth,
  selectedTag,
  dateRange,
  onTextFilterChange,
  onMonthFilterChange,
  onTagFilterChange,
  onDateRangeChange,
  onClearFilters,
}) => {
  const { t, language } = useLocalization();
  const { data } = useExpenseData();
  const filterContainerRef = useRef<HTMLDivElement>(null);

  const {
    isFilterFocused,
    handleFocus,
    handleBlur: handleBlurFromHook,
    handleChipClick,
    handleSelection,
  } = useFilterFocus();

  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next != null) {
        if (filterContainerRef.current?.contains(next)) return;
        handleBlurFromHook();
        return;
      }
      setTimeout(() => {
        const el = document.activeElement as Node | null;
        if (filterContainerRef.current?.contains(el)) return;
        handleBlurFromHook();
      }, 200);
    },
    [handleBlurFromHook]
  );

  useEffect(() => {
    if (!isFilterFocused) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (target && filterContainerRef.current && !filterContainerRef.current.contains(target)) {
        handleBlurFromHook();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isFilterFocused, handleBlurFromHook]);

  const { handleMonthClick } = useMonthFilter({
    selectedMonth,
    onMonthChange: onMonthFilterChange,
    onSelection: handleSelection,
  });

  const hasDateRange = !!(dateRange?.start && dateRange?.end);
  const hasActiveFilters = textFilter || selectedMonth || selectedTag || hasDateRange;

  const dateRangeLabel = useMemo(() => {
    if (!dateRange?.start || !dateRange?.end) return '';
    const fmt = (s: string) => {
      const d = new Date(s + 'T12:00:00');
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    };
    return `${fmt(dateRange.start)} – ${fmt(dateRange.end)}`;
  }, [dateRange]);

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
    <div
      ref={filterContainerRef}
      className="relative z-[1100] w-full flex flex-col gap-3 mb-6 overflow-x-hidden max-w-full"
      role="search"
    >
      <div className={searchBar}>
        <FiSearch className="text-white/40 text-lg shrink-0" aria-hidden />

        {hasDateRange && !isFilterFocused && (
          <div
            className={chipBase}
            onClick={handleChipClick}
            onKeyDown={(e) => e.key === 'Enter' && handleChipClick()}
            role="button"
            tabIndex={0}
            aria-label={dateRangeLabel}
            title={dateRangeLabel}
          >
            <FiCalendar aria-hidden />
            <span className="truncate max-w-[140px]">{dateRangeLabel}</span>
          </div>
        )}

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
            (selectedMonth || selectedTag || hasDateRange) && !isFilterFocused
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
          className="flex flex-col gap-0 min-h-0 max-h-[min(480px,65vh)] overflow-x-hidden w-full max-w-full overflow-y-auto rounded-2xl border border-white/[0.1] bg-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-[slideDown_0.2s_ease-out]
            [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-white/[0.04] [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/30"
          role="region"
          aria-label={t('filters.tags')}
        >
          {/* Date range */}
          <div className="flex flex-col gap-3 flex-shrink-0 px-4 pt-4 pb-1 border-b border-white/[0.06]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/50 [&_svg]:size-3.5 [&_svg]:text-[var(--color-app-accent)]">
              <FiCalendar aria-hidden />
              {t('filters.dateRange')}
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-white/70 text-sm font-medium">
                  {t('filters.dateFrom')}
                </label>
                <input
                  type="date"
                  value={dateRange?.start ?? ''}
                  onChange={(e) => {
                    const start = e.target.value;
                    const end = dateRange?.end ?? '';
                    if (!start && !end) onDateRangeChange(null);
                    else {
                      const defaultEnd = start ? (start > new Date().toISOString().slice(0, 10) ? start : new Date().toISOString().slice(0, 10)) : '';
                      onDateRangeChange({ start, end: end || defaultEnd });
                    }
                  }}
                  className="min-h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-accent)]/40 focus:border-white/20"
                  aria-label={t('filters.dateFrom')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-white/70 text-sm font-medium">
                  {t('filters.dateTo')}
                </label>
                <input
                  type="date"
                  value={dateRange?.end ?? ''}
                  onChange={(e) => {
                    const end = e.target.value;
                    const start = dateRange?.start ?? '';
                    if (!start && !end) onDateRangeChange(null);
                    else onDateRangeChange({ start: start || end, end });
                  }}
                  min={dateRange?.start}
                  className="min-h-11 w-full rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-app-accent)]/40 focus:border-white/20"
                  aria-label={t('filters.dateTo')}
                />
              </div>
            </div>
          </div>

          {availableTags.length > 0 && (
            <div className="flex flex-col gap-3 flex-shrink-0 px-4 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-white/50 [&_svg]:size-3.5 [&_svg]:text-[var(--color-app-accent)]">
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

          <div className="flex-shrink-0 px-4 py-4">
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
