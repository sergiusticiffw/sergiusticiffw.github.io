import React, { useEffect } from 'react';
import { useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { formatNumber } from '@utils/utils';
import { DataState, TransactionOrIncomeItem } from '@type/types';
import './LastTwoMonthsAverage.scss';

const LastTwoMonthsAverage = () => {
  const { data } = useData() as DataState;
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
    <div className="last-two-months-average-balanced">
      <div className="content">
        <span>
          {t('home.averageSpendingLast60Days')}:{' '}
          {formatNumber(lastTwoMonthsTotal / Math.ceil(daysDiff))} / {t('home.day')}
        </span>
      </div>
    </div>
  );
};

export default LastTwoMonthsAverage;
