import React, { useEffect, useRef } from 'react';
import useSwipeActions from '@hooks/useSwipeActions';
import { getClassNamesFor, useSortableData } from '@utils/useSortableData';
import { formatNumber } from '@utils/utils';
import { TransactionOrIncomeItem } from '@type/types';
import { Edit, Trash2, ArrowUpDown, Calendar, DollarSign, FileText } from 'lucide-react';
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

interface IncomeTableProps {
  items: TransactionOrIncomeItem[];
  handleEdit: (id: string) => void;
  setShowDeleteModal: (id: string) => void;
  changedItems?: any;
  handleClearChangedItem?: any;
}

const IncomeTable: React.FC<IncomeTableProps> = ({
  items,
  handleEdit,
  setShowDeleteModal,
  handleClearChangedItem,
  changedItems,
}) => {
  const tableRef = useRef(null);
  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    deleteVisible,
    editVisible,
    extraRowStyle,
  } = useSwipeActions();

  useEffect(() => {
    Object.keys(changedItems).forEach((id) => {
      const timer = setTimeout(() => {
        handleClearChangedItem(id);
      }, 2000);
      return () => clearTimeout(timer);
    });
  }, [changedItems, handleClearChangedItem]);

  const allItems = [
    ...items,
    ...Object.values(changedItems)
      .filter((item: any) => item.type === 'removed' && item.data.type === 'incomes')
      .map((item: any) => item.data),
  ].sort((a, b) => {
    // First, compare by 'dt'
    const dateComparison = new Date(b.dt).getTime() - new Date(a.dt).getTime();
    if (dateComparison !== 0) {
      return dateComparison;
    }
    // If 'dt' values are equal, compare by 'created'
    return b.cr - a.cr;
  });

  const { sortedItems, requestSort, sortConfig } = useSortableData(
    allItems || []
  );

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden bg-card">
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                onClick={() => requestSort('dt')}
              >
                <div className="flex items-center gap-2 group">
                  <span>Date</span>
                  <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
              </TableHead>
              <TableHead
                className="font-semibold text-foreground cursor-pointer hover:bg-muted/70 transition-colors select-none"
                onClick={() => requestSort('sum')}
              >
                <div className="flex items-center gap-2 group">
                  <span>Amount</span>
                  <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Description
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                <span className="hidden md:inline">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={tableRef}>
            {sortedItems.map((element) => {
              const changeType = changedItems[element.id]?.type;
              return (
                <TableRow
                  key={element.id}
                  className={cn(
                    'group hover:bg-muted/50 transition-all duration-200 border-b border-border/50',
                    changeType && 'animate-pulse bg-muted/30'
                  )}
                  data-id={element.id}
                  onTouchStart={(e) =>
                    handleTouchStart(e, element.id, tableRef)
                  }
                  onTouchMove={(e) => handleTouchMove(e, tableRef)}
                  onTouchEnd={(e) =>
                    handleTouchEnd(
                      e,
                      tableRef,
                      element.id,
                      handleEdit,
                      setShowDeleteModal
                    )
                  }
                >
                  <TableCell>
                    <div className="text-sm font-medium text-foreground">
                      {new Date(element.dt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">
                      {formatNumber(element.sum)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground max-w-xs truncate">
                      {element.dsc}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="hidden md:flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(element.id)}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Edit Income"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowDeleteModal(element.id)}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete Income"
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
      </div>

      {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3 p-4 pb-8">
        {/* Mobile Sort Controls */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Sort by:
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => requestSort('dt')}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Date
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => requestSort('sum')}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Amount
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {sortedItems.length} items
          </div>
        </div>

        {sortedItems.map((element) => {
          const changeType = changedItems[element.id]?.type;
          return (
            <div
              key={element.id}
              className={cn(
                'bg-card border border-border rounded-lg p-4 space-y-3 transition-all duration-200 hover:shadow-md hover:border-border/70',
                changeType && 'animate-pulse bg-muted/30'
              )}
              data-id={element.id}
              onTouchStart={(e) =>
                handleTouchStart(e, element.id, tableRef)
              }
              onTouchMove={(e) => handleTouchMove(e, tableRef)}
              onTouchEnd={(e) =>
                handleTouchEnd(
                  e,
                  tableRef,
                  element.id,
                  handleEdit,
                  setShowDeleteModal
                )
              }
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-lg">
                      {formatNumber(element.sum)}
                    </div>
                    <div className="text-sm text-muted-foreground font-medium">
                      Income
                    </div>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground text-right">
                  {new Date(element.dt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                {element.dsc && (
                  <div className="text-sm bg-muted/30 p-2 rounded-md">
                    <span className="text-foreground font-medium">
                      {element.dsc}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
    </div>
  );
};

export default IncomeTable;
