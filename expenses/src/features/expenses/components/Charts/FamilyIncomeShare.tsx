import React, { useMemo } from 'react';
import { useLocalization } from '@shared/context/localization';
import { useSettingsCurrency } from '@stores/settingsStore';
import { getCategoryColor } from '@shared/ui/CategoryIcon';
import { formatNumber } from '@shared/utils/utils';
import { getCategories } from '@shared/utils/constants';
import { getDataProviderKind } from '../../../../data';
import { labelToMonthKey } from '../../budgets/model';
import CategoryDonutBreakdown from './CategoryDonutBreakdown';
import { categorySpendForMonth } from './familyTotals';
import FamilyTotalsBanner from './FamilyTotalsBanner';
import { useFamilySharedTotals } from './useFamilySharedTotals';

export interface FamilyIncomeShareProps {
  monthLabel?: string;
  visible?: boolean;
}

const FamilyIncomeShare: React.FC<FamilyIncomeShareProps> = ({
  monthLabel,
  visible = true,
}) => {
  const { t } = useLocalization();
  const currency = useSettingsCurrency();
  const categories = getCategories();
  const { household, incomeItems, totalsSource, loading } =
    useFamilySharedTotals();

  const monthKey = useMemo(() => {
    if (monthLabel) return labelToMonthKey(monthLabel);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [monthLabel]);

  const labelFor = (id: string) =>
    categories.find((c) => c.value === id)?.label ||
    (id === '0' || id === '' ? t('common.uncategorized') : id);

  const rows = useMemo(() => {
    if (!monthKey) return [];
    return categorySpendForMonth(
      incomeItems.map((item) => ({ ...item, kind: 'expense' as const })),
      monthKey,
      labelFor,
      getCategoryColor
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor uses categories/t
  }, [incomeItems, monthKey, categories, t]);

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
    !household ||
    totalsSource === 'encryption_local'
  ) {
    return null;
  }

  const hasShared = (household.shared_categories || []).length > 0;
  if (!hasShared) return null;
  if (!loading && rows.length === 0 && total <= 0) return null;

  return (
    <section>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="px-4 pt-4 pb-3">
          <h3 className="m-0 text-center text-xl font-semibold uppercase tracking-wide text-[#e0e0e3]">
            {t('family.incomeTitle')}
          </h3>
          <p className="mt-1.5 mb-0 text-center text-sm text-white/60">
            {loading && rows.length === 0
              ? t('family.totalsLoading')
              : rows.length > 0
                ? `${formatNumber(total)} ${currency} · ${t('family.incomeSpent')}`
                : t('family.incomeEmpty')}
          </p>
        </div>
        <FamilyTotalsBanner totalsSource={totalsSource} />
        {rows.length > 0 && (
          <CategoryDonutBreakdown data={donutData} currency={currency} />
        )}
      </div>
    </section>
  );
};

export default FamilyIncomeShare;
