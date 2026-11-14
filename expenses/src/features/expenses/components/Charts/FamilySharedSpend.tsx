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
import { labelToMonthKey, monthKeyLabel } from '../../budgets/model';
import CategoryDonutBreakdown from './CategoryDonutBreakdown';
import FamilyCategorySpendList from './FamilyCategorySpendList';
import {
  categorySpendForMonth,
  resolveFamilyChartItems,
} from './familyTotals';
import { useFamilySharedTotals } from './useFamilySharedTotals';

export interface FamilySharedSpendProps {
  /** Initial / controlled month label ("November 2026"). Defaults to current month. */
  monthLabel?: string;
  visible?: boolean;
  /** When false, month follows `monthLabel` only (no swipe/chevrons). */
  monthNavigation?: boolean;
}

const FamilySharedSpend: React.FC<FamilySharedSpendProps> = ({
  monthLabel,
  visible = true,
  monthNavigation = true,
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

  const initialKey = useMemo(() => {
    if (monthLabel) return labelToMonthKey(monthLabel);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [monthLabel]);

  const [viewedKey, setViewedKey] = useState<string | null>(initialKey);

  useEffect(() => {
    setViewedKey(initialKey);
  }, [initialKey]);

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

  const monthKeys = useMemo(() => {
    const keys = new Set(
      chartItems.filter((i) => i.kind === 'expense').map((i) => i.month)
    );
    if (viewedKey) keys.add(viewedKey);
    return [...keys].filter((k) => k.length === 7).sort().reverse();
  }, [chartItems, viewedKey]);

  const monthIndex = viewedKey ? monthKeys.indexOf(viewedKey) : -1;
  const canSwipeMonths = monthNavigation && monthKeys.length > 1;

  const handleMonthSwipe = useCallback(
    (direction: 'prev' | 'next') => {
      if (!monthNavigation || monthIndex < 0) return;
      // monthKeys are newest-first (same as Home calendar).
      if (direction === 'prev' && monthIndex < monthKeys.length - 1) {
        setViewedKey(monthKeys[monthIndex + 1]);
      } else if (direction === 'next' && monthIndex > 0) {
        setViewedKey(monthKeys[monthIndex - 1]);
      }
    },
    [monthNavigation, monthIndex, monthKeys]
  );

  const monthSwipeHandlers = useHorizontalMonthSwipe(
    handleMonthSwipe,
    canSwipeMonths
  );

  const labelFor = (id: string) =>
    categories.find((c) => c.value === id)?.label ||
    (id === '0' || id === '' ? t('common.uncategorized') : id);

  const rows = useMemo(() => {
    if (!viewedKey) return [];
    return categorySpendForMonth(
      chartItems,
      viewedKey,
      labelFor,
      getCategoryColor
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor uses categories/t
  }, [chartItems, viewedKey, categories, t]);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows]
  );

  const avgDaily = useMemo(() => {
    if (!viewedKey || total <= 0) return 0;
    const [y, m] = viewedKey.split('-').map(Number);
    if (!y || !m) return 0;
    const daysInMonth = new Date(y, m, 0).getDate();
    const now = new Date();
    const isCurrent =
      now.getFullYear() === y && now.getMonth() + 1 === m;
    const divisor = isCurrent
      ? Math.max(now.getDate(), 1)
      : Math.max(daysInMonth, 1);
    return total / divisor;
  }, [viewedKey, total]);

  const donutData = useMemo(
    () =>
      rows.map((row) => ({
        name: row.label,
        y: row.amount,
        color: row.color,
      })),
    [rows]
  );

  if (
    !visible ||
    getDataProviderKind() !== 'supabase' ||
    !household ||
    !viewedKey
  ) {
    return null;
  }

  const hasShared = (household.shared_categories || []).length > 0;
  const titleMonth = monthKeyLabel(viewedKey).replace(/ \d{4}$/, '');

  return (
    <section className="mb-5" {...monthSwipeHandlers}>
      <Card
        variant="surface"
        padding="none"
        className="border-[var(--color-border-subtle)] overflow-hidden"
      >
        <div className="flex items-start gap-2 px-4 pt-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-base font-bold text-app-primary">
              {t('family.chartTitle').replace('{month}', titleMonth)}
            </h3>
            <p className="mt-0.5 mb-0 text-sm text-app-muted">
              {loading && rows.length === 0
                ? t('family.totalsLoading')
                : rows.length > 0
                  ? `${formatNumber(total)} ${currency} · ${t('family.totalsSpent')} · ${formatNumber(avgDaily)} ${currency} ${t('family.totalsAvgDay')}`
                  : hasShared
                    ? t('family.totalsEmpty')
                    : t('family.totalsNoShared')}
            </p>
          </div>
          {/* Desktop/tablet chevrons; mobile uses horizontal swipe like calendar */}
          {canSwipeMonths && (
            <div className="hidden md:flex shrink-0 items-center gap-0.5 pt-0.5">
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t('common.previous')}
                disabled={monthIndex < 0 || monthIndex >= monthKeys.length - 1}
                onClick={() => handleMonthSwipe('prev')}
              >
                <FiChevronLeft size={18} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t('common.next')}
                disabled={monthIndex <= 0}
                onClick={() => handleMonthSwipe('next')}
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
              memberTotals={memberTotals}
              members={household.members || []}
              myUid={myUid}
              monthKey={viewedKey}
              categoryFilter={category}
              dateRange={dateRange}
              personalOnly={personalOnly}
              personalItems={personalFilteredItems}
            />
          </>
        )}
      </Card>
    </section>
  );
};

export default FamilySharedSpend;
