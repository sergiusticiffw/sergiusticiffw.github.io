import React, { useMemo } from 'react';
import { useStore } from '@tanstack/react-store';
import { expenseStore } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import { Card, cn } from '@shared/ui';
import { getCategoryColor } from '@shared/ui/CategoryIcon';
import { formatNumber } from '@shared/utils/utils';
import { getCategories } from '@shared/utils/constants';
import type { TransactionOrIncomeItem } from '@shared/type/types';
import { getAiItems } from '../../../../ai/data';
import { getDataProviderKind } from '../../../../data';
import CategoryDonutBreakdown from './CategoryDonutBreakdown';
import {
  categorySpendAllTime,
  resolveFamilyChartItems,
} from './familyTotals';
import { useFamilySharedTotals } from './useFamilySharedTotals';

export interface FamilySharedAllTimeProps {
  visible?: boolean;
}

const FamilySharedAllTime: React.FC<FamilySharedAllTimeProps> = ({
  visible = true,
}) => {
  const { t } = useLocalization();
  const currency = useSettingsCurrency();
  const categories = getCategories();
  const { household, familyItems, sharedCategoryIds, loading } =
    useFamilySharedTotals();

  const category = useStore(expenseStore, (s) => s.category ?? '');
  const textFilter = useStore(expenseStore, (s) => s.textFilter ?? '');
  const selectedTag = useStore(expenseStore, (s) => s.selectedTag ?? '');
  const dateRange = useStore(expenseStore, (s) => s.dateRange ?? null);
  const filteredRaw = useStore(expenseStore, (s) => s.filtered_raw);

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

  const labelFor = (id: string) =>
    categories.find((c) => c.value === id)?.label ||
    (id === '0' || id === '' ? t('common.uncategorized') : id);

  const rows = useMemo(
    () => categorySpendAllTime(chartItems, labelFor, getCategoryColor),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor uses categories/t
    [chartItems, categories, t]
  );

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + row.amount, 0),
    [rows]
  );

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
    !household
  ) {
    return null;
  }

  const hasShared = (household.shared_categories || []).length > 0;

  return (
    <section className="mb-5">
      <Card
        variant="surface"
        padding="none"
        className="border-[var(--color-border-subtle)] overflow-hidden"
      >
        <div className="flex items-start gap-2 px-4 pt-3.5 pb-2">
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-base font-bold text-app-primary">
              {t('family.chartTitleAllTime')}
            </h3>
            <p className="mt-0.5 mb-0 text-sm text-app-muted">
              {loading && rows.length === 0
                ? t('family.totalsLoading')
                : rows.length > 0
                  ? `${formatNumber(total)} ${currency} · ${t('family.totalsSpentAllTime')}`
                  : hasShared
                    ? t('family.totalsEmptyAllTime')
                    : t('family.totalsNoShared')}
            </p>
          </div>
        </div>

        {rows.length > 0 && (
          <>
            <CategoryDonutBreakdown data={donutData} currency={currency} />
            <ul className="m-0 list-none px-4 pb-4 pt-1">
              {rows.map((row) => {
                const pct = total > 0 ? (row.amount / total) * 100 : 0;
                return (
                  <li
                    key={row.id}
                    className="border-b border-white/5 py-2.5 last:border-b-0"
                  >
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-app-primary">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: row.color || '#94a3b8' }}
                          aria-hidden
                        />
                        <span className="truncate">{row.label}</span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-app-primary">
                        {formatNumber(row.amount)}
                      </span>
                    </div>
                    <div
                      className="h-1 overflow-hidden rounded-full bg-white/[0.06]"
                      role="presentation"
                    >
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-500 ease-out'
                        )}
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          background: row.color || '#94a3b8',
                        }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
};

export default FamilySharedAllTime;
