import React, { useMemo } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useSettingsCurrency } from '@stores/settingsStore';
import { useLocalization } from '@shared/context/localization';
import { getCategories } from '@shared/utils/constants';
import { getCategoryColor } from '@shared/ui/CategoryIcon';
import CategoryDonutBreakdown from '@features/expenses/components/Charts/CategoryDonutBreakdown';
import { TransactionOrIncomeItem } from '@shared/type/types';

interface MonthProps {
  month: string;
}

const Month: React.FC<MonthProps> = ({ month }) => {
  const { data } = useExpenseData();
  const currency = useSettingsCurrency();
  useLocalization();
  const items: TransactionOrIncomeItem[] | undefined =
    data?.groupedData?.[month];

  const localizedCategories = getCategories();

  const chartData = useMemo(() => {
    if (!items) return [];

    const totals: Record<string, { name: string; y: number; color?: string }> =
      {};

    for (const item of items) {
      if (item.type === 'incomes') continue;
      const category = localizedCategories.find(
        (element) => element.value === item.cat
      );
      const label = category?.label ?? item.cat;
      if (!label) continue;
      if (!totals[label]) {
        totals[label] = {
          name: label,
          y: 0,
          color: getCategoryColor(item.cat),
        };
      }
      totals[label].y = parseFloat(
        (totals[label].y + parseFloat(String(item.sum))).toFixed(2)
      );
    }

    return Object.values(totals)
      .filter((p) => p.y > 0)
      .sort((a, b) => b.y - a.y);
  }, [items, localizedCategories]);

  if (!items || !chartData.length) return null;

  return <CategoryDonutBreakdown data={chartData} currency={currency} />;
};

export default Month;
