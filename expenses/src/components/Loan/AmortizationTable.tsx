import React, { useEffect, useRef, useState, useCallback } from 'react';
import { formatNumber } from '@utils/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
} from 'lucide-react';

interface PaymentLog {
  date: string;
  rate: number | string;
  installment: number | string;
  reduction: number | string;
  interest: number | string;
  principal: number | string;
  fee: number | string;
  was_payed?: boolean | null;
  num_days?: number | null;
}

interface AnnualSummary {
  type: 'annual_summary';
  year: string;
  totalPrincipal: number;
  totalInterest: number;
  totalFees: number;
  totalPaid: number;
}

interface AmortizationTableProps {
  amortizationSchedule: (PaymentLog | AnnualSummary)[];
}

const AmortizationTable: React.FC<AmortizationTableProps> = ({
  amortizationSchedule,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [showStickyHeader, setShowStickyHeader] = useState(false);

  // Horizontal scroll synchronization with requestAnimationFrame
  const syncScroll = useCallback(() => {
    if (scrollContainerRef.current && stickyHeaderRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      stickyHeaderRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (tableRef.current) {
        const rect = tableRef.current.getBoundingClientRect();
        // Show sticky header when the table header is scrolled out of view
        const shouldShow = rect.top < 0;
        setShowStickyHeader(shouldShow);
      }
    };

    // Use passive: true for better performance
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Separate effect for horizontal scroll synchronization
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (scrollContainer) {
      const handleHorizontalScroll = () => {
        requestAnimationFrame(syncScroll);
      };

      scrollContainer.addEventListener('scroll', handleHorizontalScroll, {
        passive: true,
      });

      return () => {
        scrollContainer.removeEventListener('scroll', handleHorizontalScroll);
      };
    }
  }, [syncScroll]);

  const renderRow = (element: PaymentLog | AnnualSummary, index: number) => {
    // Check if this is an annual summary row
    if ('type' in element && element.type === 'annual_summary') {
      return (
        <TableRow
          key={`summary-${element.year}`}
          className="bg-muted/50 border-t-2 border-primary/20"
        >
          <TableCell
            className="font-semibold text-primary sticky left-0 bg-blue-100 dark:bg-blue-900 border-r border-blue-200 dark:border-blue-800 py-2 px-3 shadow-[1px_0_2px_rgba(0,0,0,0.05)]"
            style={{ position: 'sticky', left: 0 }}
          >
            <span className="text-primary font-semibold">Total {element.year}</span>
          </TableCell>
          <TableCell className="text-muted-foreground py-2 px-3">-</TableCell>
          <TableCell className="text-muted-foreground py-2 px-3">-</TableCell>
          <TableCell className="font-semibold py-2 px-3">
            {formatNumber(element.totalPaid)}
          </TableCell>
          <TableCell className="font-semibold py-2 px-3">
            {formatNumber(element.totalPrincipal)}
          </TableCell>
          <TableCell className="font-semibold py-2 px-3">
            {formatNumber(element.totalInterest)}
          </TableCell>
          <TableCell className="text-muted-foreground py-2 px-3">-</TableCell>
          <TableCell className="font-semibold py-2 px-3">
            {formatNumber(element.totalFees)}
          </TableCell>
        </TableRow>
      );
    }

    // Regular payment row (PaymentLog object)
    const payment = element as PaymentLog;
    const isPaid = payment.was_payed;

    return (
      <TableRow
        key={payment.date + '-' + index}
        className={`${
          isPaid
            ? 'bg-green-500/10 border-l-4 border-l-green-500 hover:bg-green-500/15'
            : 'hover:bg-muted/30'
        } transition-colors duration-200`}
      >
        <TableCell
          className={`font-medium sticky left-0 border-r border-blue-200 dark:border-blue-800 py-2 px-3 shadow-[1px_0_2px_rgba(0,0,0,0.05)] ${
            isPaid
              ? 'bg-blue-100 dark:bg-blue-900'
              : 'bg-blue-50 dark:bg-blue-950'
          }`}
          style={{ position: 'sticky', left: 0 }}
        >
          <div className="flex items-center gap-2">
            {isPaid && <CheckCircle className="w-4 h-4 text-green-500" />}
            <span className="text-foreground font-medium">{payment.date}</span>
          </div>
        </TableCell>
        <TableCell
          className={`py-2 px-3 ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}
        >
          {formatNumber(payment.rate)}
        </TableCell>
        <TableCell
          className={`py-2 px-3 ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}
        >
          {formatNumber(payment.num_days || 0)}
        </TableCell>
        <TableCell
          className={`font-medium py-2 px-3 ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}
        >
          {formatNumber(payment.installment)}
        </TableCell>
        <TableCell
          className={`py-2 px-3 ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}
        >
          {formatNumber(payment.reduction)}
        </TableCell>
        <TableCell
          className={`py-2 px-3 ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}
        >
          {formatNumber(payment.interest)}
        </TableCell>
        <TableCell
          className={`py-2 px-3 ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}
        >
          {formatNumber(payment.principal)}
        </TableCell>
        <TableCell
          className={`py-2 px-3 ${isPaid ? 'text-green-700 dark:text-green-400' : ''}`}
        >
          {formatNumber(payment.fee)}
        </TableCell>
      </TableRow>
    );
  };

  if (!amortizationSchedule || amortizationSchedule.length === 0) {
    return (
      <Card className="border-border/50 shadow-lg">
        <CardContent className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            No Amortization Data
          </h3>
          <p className="text-muted-foreground">
            Amortization schedule will appear here once loan data is available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Amortization Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-lg border border-border/50 overflow-hidden bg-card">
          {/* Sticky Header - Always visible when table is scrolled */}
          {showStickyHeader && (
            <div className="fixed top-0 left-0 right-0 z-50 bg-background border-b border-border/50 shadow-lg">
              <div className="overflow-x-auto" ref={stickyHeaderRef}>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead
                        className="font-semibold text-foreground sticky left-0 bg-blue-200 dark:bg-blue-800 border-r border-blue-300 dark:border-blue-700 min-w-[100px] py-2 px-3 shadow-[1px_0_2px_rgba(0,0,0,0.05)]"
                        style={{ position: 'sticky', left: 0 }}
                      >
                        Date
                      </TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[70px] py-2 px-3">
                        Rate
                      </TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[70px] py-2 px-3">
                        Days
                      </TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[100px] py-2 px-3">
                        Installment
                      </TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[100px] py-2 px-3">
                        Reduction
                      </TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[80px] py-2 px-3">
                        Interest
                      </TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[80px] py-2 px-3">
                        Principal
                      </TableHead>
                      <TableHead className="font-semibold text-foreground min-w-[70px] py-2 px-3">
                        Fee
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
              </div>
            </div>
          )}

          {/* Main Table */}
          <div className="overflow-x-auto" ref={scrollContainerRef}>
            <Table ref={tableRef}>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead
                    className="font-semibold text-foreground sticky left-0 bg-blue-200 dark:bg-blue-800 border-r border-blue-300 dark:border-blue-700 min-w-[100px] py-2 px-3 shadow-[1px_0_2px_rgba(0,0,0,0.05)]"
                    style={{ position: 'sticky', left: 0 }}
                  >
                    Date
                  </TableHead>
                  <TableHead className="font-semibold text-foreground min-w-[70px] py-2 px-3">
                    Rate
                  </TableHead>
                  <TableHead className="font-semibold text-foreground min-w-[70px] py-2 px-3">
                    Days
                  </TableHead>
                  <TableHead className="font-semibold text-foreground min-w-[100px] py-2 px-3">
                    Installment
                  </TableHead>
                  <TableHead className="font-semibold text-foreground min-w-[100px] py-2 px-3">
                    Reduction
                  </TableHead>
                  <TableHead className="font-semibold text-foreground min-w-[80px] py-2 px-3">
                    Interest
                  </TableHead>
                  <TableHead className="font-semibold text-foreground min-w-[80px] py-2 px-3">
                    Principal
                  </TableHead>
                  <TableHead className="font-semibold text-foreground min-w-[70px] py-2 px-3">
                    Fee
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {amortizationSchedule.map((element, index) =>
                  renderRow(element, index)
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AmortizationTable;
