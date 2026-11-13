import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useStore } from '@tanstack/react-store';
import { expenseStore } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useAuthState } from '@shared/context/context';
import { useLocalization } from '@shared/context/localization';
import { useHorizontalMonthSwipe } from '@shared/hooks/useHorizontalMonthSwipe';
import { Card, IconButton } from '@shared/ui';
import { getCategoryColor } from '@shared/ui/CategoryIcon';
import { formatNumber } from '@shared/utils/utils';
import { getCategories } from '@shared/utils/constants';
import type { TransactionOrIncomeItem } from '@shared/type/types';
import { getAiItems } from '../../../../ai/data';
import { getDataProviderKind } from '../../../../data';
import CategoryDonutBreakdown from './CategoryDonutBreakdown';
import FamilyCategorySpendList from './FamilyCategorySpendList';
import {
  categorySpendForYear,
  countExpenseMonths,
  filterMemberTotals,
  monthlyAverage,
  resolveFamilyChartItems,
} from './familyTotals';
import { useFamilySharedTotals } from './useFamilySharedTotals';

export interface FamilySharedYearProps {
  visible?: boolean;
}

const FamilySharedYear: React.FC<FamilySharedYearProps> = ({
  visible = true,
}) => {
  const { t } = useLocalization();
  const currency = useSettingsCurrency();
  const categories = getCategories();
  const { userDetails } = useAuthState();
  const myUid = String(userDetails?.current_user?.uid || '');
  const { household, familyItems, memberTotals, sharedCategoryIds, loading } =
    useFamilySharedTotals();

  const category = useStore(expenseStore, (s) => s.category ?? '');
  const textFilter = useStore(expenseStore, (s) => s.textFilter ?? '');
  const selectedTag = useStore(expenseStore, (s) => s.selectedTag ?? '');
  const dateRange = useStore(expenseStore, (s) => s.dateRange ?? null);
  const filteredRaw = useStore(expenseStore, (s) => s.filtered_raw);
  const personalOnly = !!(textFilter.trim() || selectedTag.trim());

  const currentYear = String(new Date().getFullYear());
  const [viewedYear, setViewedYear] = useState<string | null>(currentYear);

  const personalFilteredItems = useMemo(() => {
    if (!textFilter.trim() && !selectedTag.trim()) return [];
    return getAiItems(
      (filteredRaw as TransactionOrIncomeItem[] | undefined) ?? []
    );
  }, [filteredRaw, textFilter, selectedTag]);

  const chartItems = useMemo(
    () =>
      resolveFamilyChartItems({
        familyItems,
        shared: sharedCategoryIds,
        personalItems: personalFilteredItems,
        category,
        textFilter,
        selectedTag,
        dateRange,
      }),
    [
      familyItems,
      sharedCategoryIds,
      personalFilteredItems,
      category,
      textFilter,
      selectedTag,
      dateRange,
    ]
  );

  const yearKeys = useMemo(() => {
    const keys = new Set(
      chartItems
        .filter((i) => i.kind === 'expense' && i.month.length === 7)
        .map((i) => i.month.slice(0, 4))
    );
    if (viewedYear) keys.add(viewedYear);
    return [...keys].filter((k) => /^\d{4}$/.test(k)).sort().reverse();
  }, [chartItems, viewedYear]);

  useEffect(() => {
    if (!yearKeys.length) return;
    if (viewedYear && yearKeys.includes(viewedYear)) return;
    const preferred = yearKeys.includes(currentYear)
      ? currentYear
      : yearKeys[0];
    setViewedYear(preferred);
  }, [yearKeys, viewedYear, currentYear]);

  const yearIndex = viewedYear ? yearKeys.indexOf(viewedYear) : -1;
  const canSwipeYears = yearKeys.length > 1;

  const handleYearSwipe = useCallback(
    (direction: 'prev' | 'next') => {
      if (yearIndex < 0) return;
      // yearKeys are newest-first.
      if (direction === 'prev' && yearIndex < yearKeys.length - 1) {
        setViewedYear(yearKeys[yearIndex + 1]);
      } else if (direction === 'next' && yearIndex > 0) {
        setViewedYear(yearKeys[yearIndex - 1]);
      }
    },
    [yearIndex, yearKeys]
  );

  const yearSwipeHandlers = useHorizontalMonthSwipe(
    handleYearSwipe,
    canSwipeYears
  );

  const labelFor = (id: string) =>
    categories.find((c) => c.value === id)?.label ||
    (id === '0' || id === '' ? t('common.uncategorized') : id);

  const rows = useMemo(() => {
    if (!viewedYear) return [];
    return categorySpendForYear(
      chartItems,
      viewedYear,
      labelFor,
      getCategoryColor
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor uses categories/t
  }, [chartItems, viewedYear, categories, t]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows]
  );

  const avgMonthly = useMemo(() => {
    if (!viewedYear) return 0;
    return monthlyAverage(total, countExpenseMonths(chartItems, viewedYear));
  }, [chartItems, total, viewedYear]);

  const donutData = useMemo(
    () =>
      rows.map((row) => ({
        name: row.label,
        y: row.amount,
        color: row.color,
      })),
    [rows]
  );

  const yearMemberTotals = useMemo(
    () =>
      filterMemberTotals(memberTotals, {
        category,
        dateRange,
        yearKey: viewedYear,
      }),
    [memberTotals, category, dateRange, viewedYear]
  );

  const yearPersonalItems = useMemo(() => {
    if (!personalOnly || !viewedYear) return personalFilteredItems;
    return personalFilteredItems.filter(
      (item) =>
        item.kind === 'expense' &&
        item.month.length === 7 &&
        item.month.startsWith(viewedYear)
    );
  }, [personalFilteredItems, personalOnly, viewedYear]);

  if (
    !visible ||
    getDataProviderKind() !== 'supabase' ||
    !household ||
    !viewedYear
  ) {
    return null;
  }

  const hasShared = (household.shared_categories || []).length > 0;

  return (
    <section className="mb-5" {...yearSwipeHandlers}>
      <Card
        variant="surface"
        padding="none"
        className="border-[var(--color-border-subtle)] overflow-hidden"
      >
        <div className="flex items-start gap-2 px-4 pt-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-base font-bold text-app-primary">
              {t('family.chartTitleYear').replace('{year}', viewedYear)}
            </h3>
            <p className="mt-0.5 mb-0 text-sm text-app-muted">
              {loading && rows.length === 0
                ? t('family.totalsLoading')
                : rows.length > 0
                  ? `${formatNumber(total)} ${currency} · ${t('family.totalsSpentYear')} · ${formatNumber(avgMonthly)} ${currency} ${t('family.totalsAvgMonth')}`
                  : hasShared
                    ? t('family.totalsEmptyYear')
                    : t('family.totalsNoShared')}
            </p>
          </div>
          {canSwipeYears && (
            <div className="hidden md:flex shrink-0 items-center gap-0.5 pt-0.5">
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t('common.previous')}
                disabled={yearIndex < 0 || yearIndex >= yearKeys.length - 1}
                onClick={() => handleYearSwipe('prev')}
              >
                <FiChevronLeft size={18} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t('common.next')}
                disabled={yearIndex <= 0}
                onClick={() => handleYearSwipe('next')}
              >
                <FiChevronRight size={18} />
              </IconButton>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <>
            <CategoryDonutBreakdown data={donutData} currency={currency} />
            <FamilyCategorySpendList
              rows={rows}
              categoryTotal={total}
              memberTotals={yearMemberTotals}
              members={household.members || []}
              myUid={myUid}
              monthKey={null}
              categoryFilter={category}
              dateRange={dateRange}
              personalOnly={personalOnly}
              personalItems={yearPersonalItems}
            />
          </>
        )}
      </Card>
    </section>
  );
};

export default FamilySharedYear;
