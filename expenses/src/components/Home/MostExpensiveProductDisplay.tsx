import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { useLocalization } from '@context/localization';
import { getCategories } from '@utils/constants';
import { AuthState, DataState, TransactionOrIncomeItem } from '@type/types';
import { formatNumber } from '@utils/utils';

const MostExpensiveProductDisplay = () => {
  // All time section
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;
  const { t } = useLocalization();
  
  // Get localized categories
  const localizedCategories = getCategories();

  const items = data.filtered_raw || data.raw;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data, currency]);

  let maxSum = -Infinity;
  let transactionWithMaxSum: TransactionOrIncomeItem | undefined = undefined;

  for (const transaction of items) {
    if (transaction.type !== 'transaction') continue;
    const sum = parseFloat(transaction.sum);
    if (sum > maxSum) {
      maxSum = sum;
      transactionWithMaxSum = transaction;
    }
  }

  if (!transactionWithMaxSum) {
    return null;
  }

  const date = new Date(transactionWithMaxSum.dt);
  // Get user's language preference from localStorage or default to 'en'
  const language = localStorage.getItem('language') || 'en';
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';
  
  const formattedDate = date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <span className="heading">{t('home.mostExpensiveItem')}</span>
      <div className="most-expensive-table-container">
        <div className="table-row">
          <span className="label">{t('common.date')}</span> {formattedDate}
        </div>
        <div className="table-row">
          <span className="label">{t('common.amount')}</span>{' '}
          {formatNumber(transactionWithMaxSum?.sum)} {currency}
        </div>
        <div className="table-row">
          <span className="label">{t('common.category')}</span>{' '}
          {localizedCategories.find(cat => cat.value === transactionWithMaxSum.cat)?.label || transactionWithMaxSum.cat}
        </div>
        <div className="table-row">
          <span className="label">{t('common.description')}</span>{' '}
          {transactionWithMaxSum?.dsc}
        </div>
      </div>
    </>
  );
};

export default MostExpensiveProductDisplay;
