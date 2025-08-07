import React, { useState, useRef, useMemo } from 'react';
import useSwipeActions from '@hooks/useSwipeActions';
import { formatNumber } from '@utils/utils';
import {
  Edit,
  Trash2,
  ArrowUpDown,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PaymentsTableProps {
  payments: any[];
  onEdit: (payment: any) => void;
  onDelete: (payment: any) => void;
}

const PaymentsTable: React.FC<PaymentsTableProps> = ({
  payments,
  onEdit,
  onDelete,
}) => {
  const tableRef = useRef<HTMLTableElement>(null);
  const [sortBy, setSortBy] = useState<string>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [itemsToShow, setItemsToShow] = useState<number>(5);
  const {
    currentX,
    isDragging,
    deleteVisible,
    editVisible,
    extraRowStyle,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSwipeActions();

  const handleEdit = (payment: any) => {
    onEdit(payment);
  };

  const handleDelete = (payment: any) => {
    onDelete(payment);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleLoadMore = () => {
    setItemsToShow((prev) => prev + 7);
  };

  // Sort payments
  const sortedPayments = useMemo(() => {
    const sorted = [...payments];
    sorted.sort((a: any, b: any) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'date':
          aValue = new Date(a.fdt || '');
          bValue = new Date(b.fdt || '');
          break;
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'amount':
          aValue = parseFloat(a.fpi || '0');
          bValue = parseFloat(b.fpi || '0');
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [payments, sortBy, sortOrder]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      day: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
      fullDate: date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
    };
  };

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                onClick={() => handleSort('date')}
              >
                <div className="flex items-center gap-2 group">
                  <span>Date</span>
                  <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
              </TableHead>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center gap-2 group">
                  <span>Title</span>
                  <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
              </TableHead>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center gap-2 group">
                  <span>Amount</span>
                  <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Rate
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Status
              </TableHead>
              <TableHead className="text-right font-semibold text-foreground">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={tableRef}>
            {sortedPayments.slice(0, itemsToShow).map((payment) => {
              const isSimulated = Number(payment.fisp) === 1;
              const dateInfo = formatDate(payment.fdt);
              return (
                <TableRow
                  key={payment.id}
                  className={cn(
                    'transition-all duration-200 hover:bg-muted/50',
                    isSimulated &&
                      'bg-yellow-500/10 border-l-4 border-l-yellow-500'
                  )}
                  data-id={payment.id}
                  onTouchStart={(e) =>
                    handleTouchStart(e, payment.id, tableRef)
                  }
                  onTouchMove={(e) => handleTouchMove(e, tableRef)}
                  onTouchEnd={(e) =>
                    handleTouchEnd(
                      e,
                      tableRef,
                      payment.id,
                      () => handleEdit(payment),
                      () => handleDelete(payment)
                    )
                  }
                >
                  <TableCell>
                    <div className="flex flex-col items-center min-w-[60px]">
                      <div className="text-lg font-bold text-primary">
                        {dateInfo.day}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        {dateInfo.month}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium text-foreground">
                        {payment.title || 'Untitled Payment'}
                      </div>
                      {isSimulated && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                        >
                          Simulated
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground text-lg">
                      {formatNumber(payment.fpi || 0)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {payment.fr ? `${payment.fr}%` : '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={isSimulated ? 'secondary' : 'default'}
                      className={cn(
                        'text-xs',
                        isSimulated &&
                          'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
                      )}
                    >
                      {isSimulated ? 'Simulated' : 'Regular'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(payment)}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Edit Payment"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(payment)}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete Payment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Desktop Load More Button */}
        {sortedPayments.length > itemsToShow && (
          <div className="flex justify-center pt-6">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              className="border-border/50 hover:bg-muted/50 transition-all duration-200"
            >
              Load More ({sortedPayments.length - itemsToShow} remaining)
            </Button>
          </div>
        )}
      </div>

      {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3 p-4 pb-8">
        {/* Mobile Sort Controls */}

        {sortedPayments.slice(0, itemsToShow).map((payment) => {
          const isSimulated = Number(payment.fisp) === 1;
          const dateInfo = formatDate(payment.fdt);
          return (
            <div
              key={payment.id}
              className={cn(
                'bg-card border border-border rounded-lg p-4 space-y-3 transition-all duration-200 hover:shadow-md hover:border-border/70',
                isSimulated && 'bg-yellow-500/5 border-yellow-500/20'
              )}
              data-id={payment.id}
              onTouchStart={(e) => handleTouchStart(e, payment.id, tableRef)}
              onTouchMove={(e) => handleTouchMove(e, tableRef)}
              onTouchEnd={(e) =>
                handleTouchEnd(
                  e,
                  tableRef,
                  payment.id,
                  () => handleEdit(payment),
                  () => handleDelete(payment)
                )
              }
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-lg">
                      {formatNumber(payment.fpi || 0)}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">
                      {payment.title || 'Untitled Payment'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    {dateInfo.fullDate}
                  </div>
                  {isSimulated && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                    >
                      Simulated
                    </Badge>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Interest Rate
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    {payment.fr ? `${payment.fr}%` : '-'}
                  </div>
                </div>
                {payment.fpsf && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Fee</div>
                    <div className="text-sm font-medium text-foreground">
                      {formatNumber(payment.fpsf)}
                    </div>
                  </div>
                )}
                {payment.fnra && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      New Recurring
                    </div>
                    <div className="text-sm font-medium text-foreground">
                      {formatNumber(payment.fnra)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Load More Button */}
        {sortedPayments.length > itemsToShow && (
          <div className="flex justify-center pt-4">
            <Button
              onClick={handleLoadMore}
              variant="outline"
              className="border-border/50 hover:bg-muted/50 transition-all duration-200"
            >
              Load More ({sortedPayments.length - itemsToShow} remaining)
            </Button>
          </div>
        )}

      </div>

      {/* Swipe Actions */}
      {deleteVisible && (
        <div
          className="fixed inset-0 pointer-events-none z-50"
          style={{ ...extraRowStyle }}
        >
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-destructive text-destructive-foreground rounded-lg p-4 shadow-lg flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            <span className="text-sm font-medium">Delete</span>
          </div>
        </div>
      )}
      {editVisible && (
        <div
          className="fixed inset-0 pointer-events-none z-50"
          style={{ ...extraRowStyle }}
        >
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-primary text-primary-foreground rounded-lg p-4 shadow-lg flex items-center gap-2">
            <Edit className="w-5 h-5" />
            <span className="text-sm font-medium">Edit</span>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentsTable;
