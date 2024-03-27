import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { AuthState, DataState, TransactionOrIncomeItem } from '@type/types';
import { formatNumber, getCategory } from '@utils/utils';

export default function MostExpensiveProductDisplay() {
  // All time section
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

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
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <span className="heading">The most expensive item</span>
      <div class="most-expensive-table-container">
        <div class="table-row">
          <span class="label">Date:</span> {formattedDate}
        </div>
        <div class="table-row">
          <span class="label">Amount:</span>{' '}
          {formatNumber(transactionWithMaxSum?.sum)} {currency}
        </div>
        <div class="table-row">
          <span class="label">Category:</span>{' '}
          {getCategory[transactionWithMaxSum?.cat]}
        </div>
        <div class="table-row">
          <span class="label">Description:</span> {transactionWithMaxSum?.dsc}
        </div>
      </div>
    </>
  );
}
