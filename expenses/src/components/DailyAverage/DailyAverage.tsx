import React, { useEffect } from 'react';
import { useData } from '@context/context';
import { calculateDaysFrom, formatNumber } from '@utils/utils';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { DataState } from '@type/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ArrowUpDown, TrendingUp } from 'lucide-react';

const DailyAverage = () => {
  const { data } = useData() as DataState;

  // Re-render the component only when dependencies are changed.
  useEffect(() => {}, [data.raw, data.categoryTotals]);

  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const daysPassed = calculateDaysFrom(firstDay);
  const { sortedItems, requestSort, sortConfig } = useSortableData(
    Object.values(data.categoryTotals || [])
  );

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Daily Average Per Category
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => requestSort('y')}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowUpDown className="w-4 h-4 mr-1" />
            Sort
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {sortedItems.map((item, key) => (
            <div key={key} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
              <span className="text-sm font-medium text-foreground">
                {formatNumber(
                  parseFloat(String(item.y / daysPassed)).toFixed(2)
                )}{' '}
                / day
              </span>
            </div>
          ))}
        </div>
        
        {/* Overall Daily Average */}
        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-muted rounded-lg flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">Average Spending Per Day</span>
          </div>
          <span className="text-sm font-medium text-foreground">
            {formatNumber(
              parseFloat(String(data.totalSpent / daysPassed)).toFixed(2)
            )}{' '}
            / day
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyAverage;
