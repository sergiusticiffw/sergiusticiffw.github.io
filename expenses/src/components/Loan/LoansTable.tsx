import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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

interface LoansTableProps {
  loans: any[];
  onEdit: (loan: any) => void;
  onDelete: (loan: any) => void;
}

const LoansTable: React.FC<LoansTableProps> = ({ loans, onEdit, onDelete }) => {
  const navigate = useNavigate();
  const tableRef = useRef<HTMLTableElement>(null);
  const [sortBy, setSortBy] = useState<string>('title');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const {
    startX,
    swipedItemId,
    deleteVisible,
    editVisible,
    extraRowStyle,
    isSwiping,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useSwipeActions();

  const getLoanStatus = (loan: any) => {
    if (loan.fls === 'completed') return 'completed';
    if (loan.fls === 'in_progress') return 'active';
    return 'pending';
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'active':
        return 'Active';
      case 'pending':
        return 'Pending';
      default:
        return 'Unknown';
    }
  };

  const handleEdit = (loan: any) => {
    onEdit(loan);
  };

  const handleDelete = (loan: any) => {
    onDelete(loan);
  };

  const handleLoanClick = (loan: any) => {
    navigate(`/expenses/loan/${loan.id}`);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Sort loans
  const sortedLoans = useMemo(() => {
    const sorted = [...loans];
    sorted.sort((a: any, b: any) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'principal':
          aValue = parseFloat(a.fp || '0');
          bValue = parseFloat(b.fp || '0');
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [loans, sortBy, sortOrder]);

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
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
                onClick={() => handleSort('principal')}
              >
                <div className="flex items-center gap-2 group">
                  <span>Principal</span>
                  <ArrowUpDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </div>
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Interest Rate
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Start Date
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                End Date
              </TableHead>
              <TableHead className="font-semibold text-foreground">
                Status
              </TableHead>
              <TableHead className="font-semibold text-foreground text-right">
                <span className="hidden md:inline">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody ref={tableRef}>
            {sortedLoans.map((loan) => {
              const status = getLoanStatus(loan);
              return (
                <TableRow
                  key={loan.id}
                  className="group hover:bg-muted/50 transition-all duration-200 border-b border-border/50"
                  data-id={loan.id}
                  onTouchStart={(e) => handleTouchStart(e, loan.id, tableRef)}
                  onTouchMove={(e) => handleTouchMove(e, tableRef)}
                  onTouchEnd={(e) =>
                    handleTouchEnd(
                      e,
                      tableRef,
                      loan.id,
                      () => handleEdit(loan),
                      () => handleDelete(loan)
                    )
                  }
                >
                  <TableCell>
                    <button
                      onClick={() => handleLoanClick(loan)}
                      className="text-sm font-medium text-foreground hover:text-primary hover:underline transition-colors cursor-pointer text-left"
                    >
                      {loan.title || 'Untitled Loan'}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">
                      {formatNumber(loan.fp)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground">{loan.fr}%</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {loan.sdt}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-muted-foreground">
                      {loan.edt}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        status === 'active'
                          ? 'default'
                          : status === 'completed'
                            ? 'secondary'
                            : 'outline'
                      }
                      className={cn(
                        'text-sm font-medium',
                        status === 'active' &&
                          'bg-green-500/10 text-green-600 border-green-500/20',
                        status === 'completed' &&
                          'bg-purple-500/10 text-purple-600 border-purple-500/20',
                        status === 'pending' &&
                          'bg-orange-500/10 text-orange-600 border-orange-500/20'
                      )}
                    >
                      {getStatusText(status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="hidden md:flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(loan)}
                        className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Edit Loan"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(loan)}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="Delete Loan"
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
              onClick={() => handleSort('title')}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Title
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('principal')}
              className="h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowUpDown className="w-4 h-4 mr-1" />
              Amount
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {sortedLoans.length} items
          </div>
        </div>

        {sortedLoans.map((loan) => {
          const status = getLoanStatus(loan);
          return (
            <div
              key={loan.id}
              className="bg-card border border-border rounded-lg p-4 space-y-3 transition-all duration-200 hover:shadow-md hover:border-border/70"
              data-id={loan.id}
              onTouchStart={(e) => handleTouchStart(e, loan.id, tableRef)}
              onTouchMove={(e) => handleTouchMove(e, tableRef)}
              onTouchEnd={(e) =>
                handleTouchEnd(
                  e,
                  tableRef,
                  loan.id,
                  () => handleEdit(loan),
                  () => handleDelete(loan)
                )
              }
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-lg">
                      {formatNumber(loan.fp)}
                    </div>
                    <button
                      onClick={() => handleLoanClick(loan)}
                      className="text-sm text-muted-foreground font-medium hover:text-primary hover:underline transition-colors cursor-pointer text-left"
                    >
                      {loan.title || 'Untitled Loan'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {loan.sdt} - {loan.edt}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-muted-foreground">
                      {loan.fr}%
                    </div>
                    <Badge
                      variant={
                        status === 'active'
                          ? 'default'
                          : status === 'completed'
                            ? 'secondary'
                            : 'outline'
                      }
                      className={cn(
                        'text-xs',
                        status === 'active' &&
                          'bg-green-500/10 text-green-600 border-green-500/20',
                        status === 'completed' &&
                          'bg-purple-500/10 text-purple-600 border-purple-500/20',
                        status === 'pending' &&
                          'bg-orange-500/10 text-orange-600 border-orange-500/20'
                      )}
                    >
                      {getStatusText(status)}
                    </Badge>
                  </div>
                </div>
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

export default LoansTable;
