import React, { useEffect, useMemo, useState } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useExpenseData } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import { useApiClient } from '@shared/hooks/useApiClient';
import { Card, IconButton, cn } from '@shared/ui';
import { getCategoryColor } from '@shared/ui/CategoryIcon';
import { formatNumber } from '@shared/utils/utils';
import { getCategories } from '@shared/utils/constants';
import { getAiItems, type AiItem } from '../../../../ai/data';
import {
  getDataProviderKind,
  type Household,
} from '../../../../data';
import { labelToMonthKey, monthKeyLabel } from '../../budgets/model';
import CategoryDonutBreakdown from './CategoryDonutBreakdown';
import {
  categorySpendForMonth,
  sharedTotalsFromItems,
  totalsToAiItems,
} from './familyTotals';

export interface FamilySharedSpendProps {
  /** Initial month label ("November 2026"). Defaults to current month. */
  monthLabel?: string;
  visible?: boolean;
}

const FamilySharedSpend: React.FC<FamilySharedSpendProps> = ({
  monthLabel,
  visible = true,
}) => {
  const { t } = useLocalization();
  const { data } = useExpenseData();
  const currency = useSettingsCurrency();
  const api = useApiClient();
  const categories = getCategories();

  const [household, setHousehold] = useState<Household | null>(null);
  const [familyItems, setFamilyItems] = useState<AiItem[]>([]);
  const [loading, setLoading] = useState(false);

  const initialKey = useMemo(() => {
    if (monthLabel) return labelToMonthKey(monthLabel);
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, [monthLabel]);

  const [viewedKey, setViewedKey] = useState<string | null>(initialKey);

  useEffect(() => {
    setViewedKey(initialKey);
  }, [initialKey]);

  const personalItems = useMemo(
    () => getAiItems(data.raw || []),
    [data.raw]
  );

  useEffect(() => {
    if (getDataProviderKind() !== 'supabase' || !api) return;
    let cancelled = false;
    (async () => {
      const house = await api.getHousehold();
      if (cancelled || !house.success) return;
      setHousehold(house.data ?? null);
      if (!house.data) setFamilyItems([]);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!household || getDataProviderKind() !== 'supabase') {
      return;
    }
    const shared = new Set(
      (household.shared_categories || []).map((id) => String(id))
    );
    const local = sharedTotalsFromItems(personalItems, shared);
    setFamilyItems(local);

    if (!api) return;

    let cancelled = false;
    setLoading(true);
    (async () => {
      const result = await api.listFamilyCategoryTotals();
      if (cancelled) return;
      setLoading(false);
      if (result.success && result.data && result.data.length > 0) {
        setFamilyItems(totalsToAiItems(result.data));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, household, personalItems]);

  const monthKeys = useMemo(() => {
    const keys = new Set(
      familyItems.filter((i) => i.kind === 'expense').map((i) => i.month)
    );
    if (viewedKey) keys.add(viewedKey);
    return [...keys].filter((k) => k.length === 7).sort().reverse();
  }, [familyItems, viewedKey]);

  const monthIndex = viewedKey ? monthKeys.indexOf(viewedKey) : -1;

  const labelFor = (id: string) =>
    categories.find((c) => c.value === id)?.label ||
    (id === '0' || id === '' ? t('common.uncategorized') : id);

  const rows = useMemo(() => {
    if (!viewedKey) return [];
    return categorySpendForMonth(
      familyItems,
      viewedKey,
      labelFor,
      getCategoryColor
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor uses categories/t
  }, [familyItems, viewedKey, categories, t]);

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
    !viewedKey
  ) {
    return null;
  }

  const hasShared = (household.shared_categories || []).length > 0;
  const titleMonth = monthKeyLabel(viewedKey).replace(/ \d{4}$/, '');

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
              {t('family.chartTitle').replace('{month}', titleMonth)}
            </h3>
            <p className="mt-0.5 mb-0 text-sm text-app-muted">
              {loading && rows.length === 0
                ? t('family.totalsLoading')
                : rows.length > 0
                  ? `${formatNumber(total)} ${currency} · ${t('family.totalsSpent')}`
                  : hasShared
                    ? t('family.totalsEmpty')
                    : t('family.totalsNoShared')}
            </p>
          </div>
          {monthKeys.length > 1 && (
            <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t('common.previous')}
                disabled={monthIndex < 0 || monthIndex >= monthKeys.length - 1}
                onClick={() => {
                  if (monthIndex >= 0 && monthIndex < monthKeys.length - 1) {
                    setViewedKey(monthKeys[monthIndex + 1]);
                  }
                }}
              >
                <FiChevronLeft size={18} />
              </IconButton>
              <IconButton
                variant="ghost"
                size="sm"
                aria-label={t('common.next')}
                disabled={monthIndex <= 0}
                onClick={() => {
                  if (monthIndex > 0) setViewedKey(monthKeys[monthIndex - 1]);
                }}
              >
                <FiChevronRight size={18} />
              </IconButton>
            </div>
          )}
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

export default FamilySharedSpend;
