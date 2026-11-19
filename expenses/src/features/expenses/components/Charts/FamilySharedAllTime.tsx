import React, { useMemo } from 'react';
import { useStore } from '@tanstack/react-store';
import { expenseStore } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useAuthState } from '@shared/context/context';
import { useLocalization } from '@shared/context/localization';
import { getCategoryColor } from '@shared/ui/CategoryIcon';
import { formatNumber } from '@shared/utils/utils';
import { getCategories } from '@shared/utils/constants';
import type { TransactionOrIncomeItem } from '@shared/type/types';
import { getAiItems } from '../../../../ai/data';
import { getDataProviderKind } from '../../../../data';
import CategoryDonutBreakdown from './CategoryDonutBreakdown';
import FamilyCategorySpendList from './FamilyCategorySpendList';
import {
  categorySpendAllTime,
  countExpenseMonths,
  monthlyAverage,
  resolveFamilyChartItems,
} from './familyTotals';
import FamilyTotalsBanner from './FamilyTotalsBanner';
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
  const { userDetails } = useAuthState();
  const myUid = String(userDetails?.current_user?.uid || '');
  const {
    household,
    familyItems,
    memberTotals,
    sharedCategoryIds,
    loading,
    totalsSource,
  } = useFamilySharedTotals();

  const category = useStore(expenseStore, (s) => s.category ?? '');
  const textFilter = useStore(expenseStore, (s) => s.textFilter ?? '');
  const selectedTag = useStore(expenseStore, (s) => s.selectedTag ?? '');
  const dateRange = useStore(expenseStore, (s) => s.dateRange ?? null);
  const filteredRaw = useStore(expenseStore, (s) => s.filtered_raw);
  const personalOnly = !!(textFilter.trim() || selectedTag.trim());

  const personalFilteredItems = useMemo(() => {
    if (!personalOnly) return [];
    return getAiItems(
      (filteredRaw as TransactionOrIncomeItem[] | undefined) ?? []
    );
  }, [filteredRaw, personalOnly]);

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

  const avgMonthly = useMemo(
    () => monthlyAverage(total, countExpenseMonths(chartItems)),
    [chartItems, total]
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
    <section>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="px-4 pt-4 pb-3">
          <h3 className="m-0 text-center text-xl font-semibold uppercase tracking-wide text-[#e0e0e3]">
            {t('family.chartTitleAllTime')}
          </h3>
          <p className="mt-1.5 mb-0 text-center text-sm text-white/60">
            {loading && rows.length === 0
              ? t('family.totalsLoading')
              : rows.length > 0
                ? `${formatNumber(total)} ${currency} · ${t('family.totalsSpentAllTime')} · ${formatNumber(avgMonthly)} ${currency} ${t('family.totalsAvgMonth')}`
                : hasShared
                  ? t('family.totalsEmptyAllTime')
                  : t('family.totalsNoShared')}
          </p>
        </div>

        <FamilyTotalsBanner
          totalsSource={totalsSource}
          personalOnly={personalOnly}
        />

        {rows.length > 0 && (
          <>
            {!category && (
              <CategoryDonutBreakdown data={donutData} currency={currency} />
            )}
            <FamilyCategorySpendList
              rows={rows}
              categoryTotal={total}
              memberTotals={memberTotals}
              members={household.members || []}
              myUid={myUid}
              monthKey={null}
              categoryFilter={category}
              dateRange={dateRange}
              personalOnly={personalOnly}
              personalItems={personalFilteredItems}
            />
          </>
        )}
      </div>
    </section>
  );
};

export default FamilySharedAllTime;
