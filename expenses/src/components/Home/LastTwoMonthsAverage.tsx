import React, { useEffect } from 'react';
import { useAuthState, useData } from '@context/context';
import { formatNumber } from '@utils/utils';
import { DataState, TransactionOrIncomeItem, AuthState } from '@type/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Calendar } from 'lucide-react';

const LastTwoMonthsAverage = () => {
  const { data } = useData() as DataState;
  const { currency } = useAuthState() as AuthState;

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

  const averagePerDay = lastTwoMonthsTotal / Math.ceil(daysDiff);
  
  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Last 60 Days Average
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <span className="text-sm text-muted-foreground">Average Spending Per Day</span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {formatNumber(averagePerDay)} {currency} / day
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default LastTwoMonthsAverage;
