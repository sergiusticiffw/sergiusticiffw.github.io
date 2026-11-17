import React, { useMemo } from 'react';
import { useLocalization } from '@shared/context/localization';
import { useSettingsCurrency } from '@stores/settingsStore';
import { formatNumber } from '@shared/utils/utils';
import { getCategories } from '@shared/utils/constants';
import { getDataProviderKind } from '../../../../data';
import { labelToMonthKey } from '../../budgets/model';
import { categorySpendForMonth } from './familyTotals';
import { useFamilySharedTotals } from './useFamilySharedTotals';

export interface FamilyGoalsProgressProps {
  monthLabel?: string;
  visible?: boolean;
}

const FamilyGoalsProgress: React.FC<FamilyGoalsProgressProps> = ({
  monthLabel,
  visible = true,
}) => {
  const { t } = useLocalization();
  const currency = useSettingsCurrency();
  const categories = getCategories();
  const { household, familyItems, totalsSource } = useFamilySharedTotals();

  const monthKey = useMemo(() => {
    if (monthLabel) return labelToMonthKey(monthLabel);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [monthLabel]);

  const spentByCat = useMemo(() => {
    if (!monthKey) return new Map<string, number>();
    const labelFor = (id: string) => id;
    const rows = categorySpendForMonth(familyItems, monthKey, labelFor);
    return new Map(rows.map((r) => [r.id, r.amount]));
  }, [familyItems, monthKey]);

  const goals = household?.goals || [];

  if (
    !visible ||
    getDataProviderKind() !== 'supabase' ||
    !household ||
    goals.length === 0 ||
    totalsSource === 'none'
  ) {
    return null;
  }

  return (
    <section>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="px-4 pt-4 pb-3">
          <h3 className="m-0 text-center text-xl font-semibold uppercase tracking-wide text-[#e0e0e3]">
            {t('family.goals')}
          </h3>
          <p className="mt-1.5 mb-0 text-center text-sm text-white/60">
            {t('family.goalsHint')}
          </p>
        </div>
        <ul className="m-0 list-none border-t border-white/10">
          {goals.map((goal) => {
            const spent = spentByCat.get(goal.category_id) || 0;
            const limit = goal.monthly_limit;
            const ratio = limit > 0 ? Math.min(spent / limit, 1.25) : 0;
            const over = spent > limit + 0.005;
            const label =
              categories.find((c) => c.value === goal.category_id)?.label ||
              goal.category_id;
            return (
              <li
                key={goal.category_id}
                className="border-b border-white/5 px-4 py-3 last:border-b-0"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[0.95rem]">
                  <span className="min-w-0 truncate font-medium text-white">
                    {label}
                  </span>
                  <span
                    className={
                      over
                        ? 'tabular-nums text-rose-300'
                        : 'tabular-nums text-white/70'
                    }
                  >
                    {formatNumber(spent)} / {formatNumber(limit)} {currency}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full transition-[width] duration-500"
                    style={{
                      width: `${Math.min(ratio, 1) * 100}%`,
                      background: over
                        ? '#ff8f8f'
                        : 'var(--color-app-accent)',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default FamilyGoalsProgress;
