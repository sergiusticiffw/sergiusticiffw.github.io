import React, { useEffect } from 'react';
import { useExpenseData } from '@stores/expenseStore';
import { useLocalization } from '@shared/context/localization';
import { formatNumber } from '@shared/utils/utils';
import { TransactionOrIncomeItem } from '@shared/type/types';

const LastTwoMonthsAverage = () => {
  const { data } = useExpenseData();
  const { t } = useLocalization();

  useEffect(() => {}, [data.raw]);

  let lastTwoMonthsTotal: number = 0;
  let userHasMoreThanTwoMonths = false;
  let lastProcessedItem = {};
  const twoMonthsAgo = new Date().setDate(new Date().getDate() - 60);

  for (const item of data.raw) {
    if ((item as TransactionOrIncomeItem).type === 'incomes') {
      continue;
    }
    const itemDate = new Date((item as TransactionOrIncomeItem).dt);
    if (itemDate < new Date(twoMonthsAgo)) {
      userHasMoreThanTwoMonths = true;
      break;
    }
    lastProcessedItem = item as TransactionOrIncomeItem;
    lastTwoMonthsTotal = lastTwoMonthsTotal + parseFloat(item.sum);
  }

  const timeDiff =
    new Date().getTime() -
    new Date((lastProcessedItem as TransactionOrIncomeItem).dt).getTime();
  const daysDiff = userHasMoreThanTwoMonths
    ? 60
    : timeDiff / (1000 * 3600 * 24);

  return (
    <div className="my-3 md:my-2 bg-white/[0.05] border border-white/10 overflow-hidden rounded-xl">
      <div className="p-4 md:p-3 text-center">
        <span className="text-white text-base md:text-[0.9rem] font-medium leading-relaxed">
          {t('home.averageSpendingLast60Days')}:{' '}
          {formatNumber(lastTwoMonthsTotal / Math.ceil(daysDiff))} / {t('home.day')}
        </span>
      </div>
    </div>
  );
};

export default LastTwoMonthsAverage;
