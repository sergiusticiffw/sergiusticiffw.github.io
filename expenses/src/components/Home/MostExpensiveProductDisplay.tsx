import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { AuthState, DataState, TransactionOrIncomeItem } from '@type/types';
import { formatNumber, getCategory } from '@utils/utils';
import { getIconForCategory } from '@utils/helper';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar, DollarSign, Tag, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const MostExpensiveProductDisplay = () => {
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
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No transactions found</p>
      </div>
    );
  }

  const date = new Date(transactionWithMaxSum.dt);
  const formattedDate = date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="space-y-3">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-1">Most Expensive</p>
        <p className="text-2xl font-bold text-foreground">
          {formatNumber(transactionWithMaxSum?.sum)} {currency}
        </p>
      </div>
      
      <div className="flex items-center justify-center gap-2">
        <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
          {getIconForCategory(getCategory[transactionWithMaxSum.cat as string])}
        </div>
        <Badge variant="secondary" className="text-xs">
          {getCategory[transactionWithMaxSum.cat as string]}
        </Badge>
      </div>
      
      {transactionWithMaxSum?.dsc && (
        <div className="text-center px-2">
          <p className="text-sm text-muted-foreground break-words leading-relaxed">{transactionWithMaxSum?.dsc}</p>
        </div>
      )}
    </div>
  );
};

export default MostExpensiveProductDisplay;
