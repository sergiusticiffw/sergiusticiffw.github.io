import React, { useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { deleteNode, fetchData, formatNumber } from '@utils/utils';
import TransactionForm from '@components/TransactionForm';
import TransactionsTable from '@components/TransactionsTable';
import { ExpenseCalendar } from '@components/Calendar';
import Filters from '@components/Filters';
import { monthNames, notificationType } from '@utils/constants';
import {
  ChevronLeft,
  ChevronRight,
  Table,
  Calendar,
  Trash2,
  Edit,
  Plus,
  DollarSign,
} from 'lucide-react';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import { NumberDisplay } from '@components/Home';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const Home = () => {
  const showNotification = useNotification();
  const { token } = useAuthState() as AuthState;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const dispatch = useAuthDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (noData) {
      fetchData(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, token, noData, dispatch]);

  const items = data.filtered || data;

  const [focusedItem, setFocusedItem] = useState({});

  const handleClearChangedItem = (id: string) => {
    dataDispatch({ type: 'CLEAR_CHANGED_ITEM', id });
  };

  const handleEdit = (id: string) => {
    const item = items.groupedData[currentMonth].find(
      (item: TransactionOrIncomeItem) => item.id === id
    );
    setFocusedItem({
      nid: item.id,
      field_date: item.dt,
      field_amount: item.sum,
      field_category: item.cat,
      field_description: item.dsc,
    });
    setShowEditModal(true);
  };

  const handleDelete = (showDeleteModal: boolean, token: string) => {
    setIsSubmitting(true);
    // @ts-expect-error
    deleteNode(showDeleteModal, token, (response: Response) => {
      if (response.ok) {
        showNotification(
          'Transaction was successfully deleted.',
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification('Something went wrong.', notificationType.ERROR);
        setIsSubmitting(false);
      }
      setShowDeleteModal(false);
      fetchData(
        token,
        dataDispatch,
        dispatch,
        data.category as string,
        data.textFilter as string
      );
    });
  };

  const months = items.groupedData ? Object.keys(items.groupedData) : [];
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const currentMonth = months[currentMonthIndex]
    ? months[currentMonthIndex]
    : months[0];

  useEffect(() => {
    if (data?.filtered) {
      const index = Object.keys(months).find(
        // @ts-expect-error
        (key: string) => months[key] === currentMonth
      );
      setCurrentMonthIndex(parseInt(index as string));
    } else {
      setCurrentMonthIndex(0);
    }
  }, [data.filtered]);

  // Get today's date
  const today = new Date();
  const total = items.totals?.[currentMonth];
  const incomeTotals = items.incomeTotals;
  let totalSumForCategory = 0;
  let weekPercentage;
  let monthPercentage = 100;
  const { weeklyBudget, monthlyBudget } = useAuthState() as AuthState;
  const isCurrentMonth =
    `${monthNames[today.getMonth()]} ${today.getFullYear()}` === currentMonth;

  const isWeekBudget = !data?.filtered && isCurrentMonth && weeklyBudget;
  const isMonthBudget = !data?.filtered && isCurrentMonth && monthlyBudget;
  if (isMonthBudget) {
    monthPercentage = 100 - (total / parseInt(monthlyBudget)) * 100;
    monthPercentage = monthPercentage <= 0 ? 0.01 : monthPercentage;
  }
  if (isWeekBudget) {
    // Calculate the date of the last Monday
    const lastMonday = new Date(today);
    lastMonday.setDate(lastMonday.getDate() - ((today.getDay() + 6) % 7));
    // Get the parts of the date
    const year = lastMonday.getFullYear();
    const month = String(lastMonday.getMonth() + 1).padStart(2, '0');
    const day = String(lastMonday.getDate()).padStart(2, '0');
    // Form the formatted date string 'YYYY-MM-DD'
    const formattedLastMonday = `${year}-${month}-${day}`;

    totalSumForCategory =
      data?.raw
        ?.filter(
          (transaction: TransactionOrIncomeItem) =>
            transaction.dt >= formattedLastMonday
        )
        ?.filter(
          (transaction: TransactionOrIncomeItem) =>
            transaction.type === 'transaction'
        )
        ?.filter(
          (transaction: TransactionOrIncomeItem) =>
            ![6, 9, 10, 12, 13, 11].includes(
              parseInt(transaction.cat as string)
            )
        )
        ?.reduce(
          (total: number, transaction: TransactionOrIncomeItem) =>
            total + parseFloat(transaction.sum),
          0
        ) || 0;

    weekPercentage = 100 - (totalSumForCategory / parseInt(weeklyBudget)) * 100;
    weekPercentage = weekPercentage <= 0 ? 0.01 : weekPercentage;
  }

  const income = incomeTotals ? incomeTotals[currentMonth] : -1;
  const profit = parseFloat((income - total).toFixed(2));
  const [activeTab, setActiveTab] = useState('table');

  const handleMonthChange = (newMonthIndex: number) => {
    setCurrentMonthIndex(newMonthIndex);
  };

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(showDeleteModal, token)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Transaction Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Transaction</DialogTitle>
            <DialogDescription>
              Update the transaction details below.
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            formType="edit"
            values={focusedItem}
            onSuccess={() => {
              setShowEditModal(false);
              fetchData(
                token,
                dataDispatch,
                dispatch,
                data.category,
                data.textFilter
              );
            }}
          />
        </DialogContent>
      </Dialog>
      <div className="space-y-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
                <DollarSign className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
                  {currentMonth || 'Expenses'}
                </h1>
                <p className="text-muted-foreground">Track and manage your financial transactions</p>
              </div>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-105 w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Add Transaction
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Transaction</DialogTitle>
                <DialogDescription>
                  Enter the details for your new transaction.
                </DialogDescription>
              </DialogHeader>
              <TransactionForm
                formType="add"
                values={{}}
                onSuccess={() => {
                  fetchData(
                    token,
                    dataDispatch,
                    dispatch,
                    data.category,
                    data.textFilter
                  );
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <Filters />

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        ) : noData ? (
          <div className="text-center py-12 text-muted-foreground">
            No data available
          </div>
        ) : (
          <div className="space-y-6 pb-8">
            {Object.keys(items.groupedData).length ? (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 group">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Spent</CardTitle>
                        <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                          <DollarSign className="w-4 h-4 text-red-500" />
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-foreground">
                        <NumberDisplay number={total} />
                      </div>
                      {isMonthBudget && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Budget</span>
                            <span>{formatNumber(monthlyBudget)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-red-500 to-red-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min((total / monthlyBudget) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {income > 0 && (
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300 group">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
                          <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <DollarSign className="w-4 h-4 text-green-500" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-foreground">
                          <NumberDisplay number={income} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {income > 0 && (
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 group">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Net Profit</CardTitle>
                          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <DollarSign className="w-4 h-4 text-blue-500" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-foreground">
                          <NumberDisplay number={profit} />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {isWeekBudget && (
                    <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 group">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium text-muted-foreground">Week Budget</CardTitle>
                          <div className="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                            <Calendar className="w-4 h-4 text-purple-500" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-foreground">
                          <NumberDisplay number={totalSumForCategory} />
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Weekly Limit</span>
                            <span>{formatNumber(weeklyBudget)}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min((totalSumForCategory / weeklyBudget) * 100, 100)}%` }}
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* View Toggle */}
                <div className="flex items-center justify-center gap-2 p-1 bg-muted/50 rounded-lg w-full sm:w-fit mx-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('table')}
                    className={cn(
                      "transition-all duration-200",
                      activeTab === 'table' 
                        ? "shadow-md" 
                        : "hover:bg-background/50"
                    )}
                  >
                    <Table className="w-4 h-4 mr-2" />
                    Table
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('calendar')}
                    className={cn(
                      "transition-all duration-200",
                      activeTab === 'calendar' 
                        ? "shadow-md" 
                        : "hover:bg-background/50"
                    )}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Calendar
                  </Button>
                </div>

                {/* Content */}
                {activeTab === 'calendar' ? (
                  <ExpenseCalendar
                    items={items.groupedData[currentMonth]}
                    months={months}
                    setCurrentMonthIndex={handleMonthChange}
                    currentMonthIndex={currentMonthIndex}
                    currentMonth={currentMonth}
                  />
                ) : (
                  <div className="space-y-4">
                    <TransactionsTable
                      items={items.groupedData[currentMonth]}
                      handleEdit={handleEdit}
                      setShowDeleteModal={setShowDeleteModal}
                      changedItems={data.changedItems}
                      handleClearChangedItem={handleClearChangedItem}
                    />
                    
                    {/* Desktop Navigation */}
                    <div className="hidden md:flex justify-between items-center p-3 sm:p-4 bg-muted/30 rounded-lg">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!months[currentMonthIndex + 1]}
                        onClick={() => setCurrentMonthIndex(currentMonthIndex + 1)}
                        className="hover:bg-background transition-all duration-200"
                      >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {currentMonthIndex + 1}
                        </span>
                        <span className="text-sm text-muted-foreground">of</span>
                        <span className="text-sm font-medium text-foreground">
                          {months.length}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!months[currentMonthIndex - 1]}
                        onClick={() => setCurrentMonthIndex(currentMonthIndex - 1)}
                        className="hover:bg-background transition-all duration-200"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-dashed border-border">
                <CardContent className="text-center py-16">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No transactions yet</h3>
                  <p className="text-muted-foreground mb-6">Start tracking your expenses by adding your first transaction.</p>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 transition-all duration-200 hover:scale-105">
                        <Plus className="w-4 h-4 mr-2" />
                        Add First Transaction
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Add New Transaction</DialogTitle>
                        <DialogDescription>
                          Enter the details for your new transaction.
                        </DialogDescription>
                      </DialogHeader>
                      <TransactionForm
                        formType="add"
                        values={{}}
                        onSuccess={() => {
                          fetchData(
                            token,
                            dataDispatch,
                            dispatch,
                            data.category,
                            data.textFilter
                          );
                        }}
                      />
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Mobile Fixed Bottom Pager - Only for Table View */}
      <div className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border/50 p-4 shadow-lg transition-all duration-300",
        activeTab === 'table' ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            size="sm"
            disabled={!months[currentMonthIndex + 1]}
            onClick={() => setCurrentMonthIndex(currentMonthIndex + 1)}
            className="flex-1 mr-2"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>
          <div className="flex items-center gap-2 px-4">
            <span className="text-sm font-medium text-foreground">
              {currentMonthIndex + 1}
            </span>
            <span className="text-sm text-muted-foreground">of</span>
            <span className="text-sm font-medium text-foreground">
              {months.length}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!months[currentMonthIndex - 1]}
            onClick={() => setCurrentMonthIndex(currentMonthIndex - 1)}
            className="flex-1 ml-2"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Home;
