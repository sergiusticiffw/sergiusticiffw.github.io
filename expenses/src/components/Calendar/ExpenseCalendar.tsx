import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import TransactionsTable from '@components/TransactionsTable/TransactionsTable';
import { AuthState, TransactionOrIncomeItem, DataState } from '@type/types';
import TransactionForm from '@components/TransactionForm/TransactionForm';
import MostExpensiveProductDisplay from '@components/Home/MostExpensiveProductDisplay';
import { deleteNode, fetchData, formatNumber } from '@utils/utils';
import { notificationType, colorMap } from '@utils/constants';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Trash2,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import Month from '@components/Home/Month';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface ExpenseCalendarProps {
  currentMonthIndex: number;
  currentMonth: string;
  setCurrentMonthIndex: (newMonthIndex: number) => void;
}

const ExpenseCalendar: React.FC<ExpenseCalendarProps> = ({
  setCurrentMonthIndex,
  currentMonthIndex,
  currentMonth,
  items,
  months,
}) => {
  const { theme } = useAuthState() as AuthState;
  const { data, dataDispatch } = useData() as DataState;
  const showNotification = useNotification();
  const { token } = useAuthState() as AuthState;

  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const dispatch = useAuthDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nextDisabled, setNextDisabled] = useState(false);
  const [todayDisabled, setTodayDisabled] = useState(false);
  const [prevDisabled, setPrevDisabled] = useState(false);

  const handleEdit = (id: string) => {
    // @ts-expect-error
    const item = selectedEvent?.data?.find(
      (item: TransactionOrIncomeItem) => item.id === id
    );
    setFocusedItem({
      nid: item.id,
      field_date: item.dt,
      field_amount: item.sum,
      field_category: item.cat,
      field_description: item.dsc,
    });
    setShowModal(false);
    setShowEditModal(true);
  };

  const groupByDate = useCallback((transactions: TransactionOrIncomeItem[]) => {
    const groupedTransactions = (transactions ?? []).reduce(
      (acc, transaction) => {
        const { type, dt: date, sum } = transaction;
        if (type === 'transaction') {
          const parsedSum = parseFloat(sum);
          // @ts-expect-error
          if (!acc[date]) {
            // @ts-expect-error
            acc[date] = parsedSum;
          } else {
            // @ts-expect-error
            acc[date] += parsedSum;
          }
        }
        return acc;
      },
      {}
    );

    return Object.keys(groupedTransactions).map((date) => ({
      date,
      // @ts-expect-error
      sum: groupedTransactions[date],
    }));
  }, []);

  const getTransactionsByDate = (id: string) => {
    return (items ?? [])?.filter(
      (item: TransactionOrIncomeItem) =>
        item.dt === id && item.type === 'transaction'
    );
  };

  useEffect(() => {
    const formattedEvents = (groupByDate(items) ?? []).map((expense) => ({
      id: expense.date,
      title: expense.sum,
      allDay: true,
      start: new Date(expense.date),
      end: new Date(expense.date),
    }));
    // @ts-expect-error
    setEvents(formattedEvents);
  }, [items]);

  const handleEventSelect = (event: { event: { id: string } }) => {
    const selectedItems = getTransactionsByDate(event.event.id);
    const date = new Date(event.event.id);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    setSelectedEvent({
      // @ts-expect-error
      title: formattedDate,
      data: selectedItems,
    });
    setShowModal(true);
  };

  const [idToRemove, setId] = useState('');
  const handleDelete = (id: string, token: string) => {
    setId(id);
    setShowModal(false);
    setShowDeleteModal(true);
    if (id && showDeleteModal) {
      setIsSubmitting(true);
      deleteNode(idToRemove, token, (response: Response) => {
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
    }
  };

  const renderEventContent = useCallback(
    (eventInfo: { event: { title: string } }) => {
      return <>{formatNumber(eventInfo.event.title)}</>;
    },
    []
  );

  const calendarRef = useRef(null);
  const date = new Date(`01 ${months[currentMonthIndex]}`);

  useEffect(() => {
    if (calendarRef.current) {
      // @ts-expect-error
      calendarRef.current.getApi().gotoDate(date);
    }
  }, [date]);

  const handleDatesSet = (dateInfo: any) => {
    const startDate = new Date(dateInfo.startStr);
    const endDate = new Date(dateInfo.endStr);
    const dateToCheck = new Date();

    if (dateToCheck >= startDate && dateToCheck <= endDate) {
      setNextDisabled(true);
    } else {
      if (!months[currentMonthIndex - 1]) {
        setNextDisabled(true);
        setTodayDisabled(true);
      } else {
        setTodayDisabled(false);
        setNextDisabled(false);
      }

      if (!months[currentMonthIndex + 1]) {
        setPrevDisabled(true);
      } else {
        setPrevDisabled(false);
      }
    }
  };

  let touchStartX = 0;
  let touchEndX = 0;
  let isSwiping = false;

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX = event.touches[0].clientX;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    touchEndX = event.touches[0].clientX;
    isSwiping = true;
  };

  const handleTouchEnd = () => {
    if (isSwiping) {
      const deltaX = touchEndX - touchStartX;
      const thresholdPercentage = 0.25;
      const containerWidth = window.innerWidth;
      const threshold = containerWidth * thresholdPercentage;

      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          if (prevDisabled) return;
          setCurrentMonthIndex(currentMonthIndex + 1);
          // @ts-expect-error
          calendarRef.current.getApi().prev();
        } else {
          if (nextDisabled) return;
          setCurrentMonthIndex(currentMonthIndex - 1);
          // @ts-expect-error
          calendarRef.current.getApi().next();
        }
      }
    }
    isSwiping = false;
  };

  const handleClearChangedItem = (id: string) => {
    dataDispatch({ type: 'CLEAR_CHANGED_ITEM', id });
  };

  return (
    <>
      <Card className="border-border/50 shadow-lg">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!prevDisabled) {
                    setCurrentMonthIndex(currentMonthIndex + 1);
                    // @ts-expect-error
                    calendarRef.current.getApi().prev();
                  }
                }}
                disabled={prevDisabled}
                className="hover:bg-background transition-all duration-200"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!todayDisabled) {
                    setCurrentMonthIndex(0);
                    // @ts-expect-error
                    calendarRef.current.getApi().gotoDate(new Date());
                  }
                }}
                disabled={todayDisabled}
                className="hover:bg-background transition-all duration-200"
              >
                Today
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!nextDisabled) {
                    setCurrentMonthIndex(currentMonthIndex - 1);
                    // @ts-expect-error
                    calendarRef.current.getApi().next();
                  }
                }}
                disabled={nextDisabled}
                className="hover:bg-background transition-all duration-200"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div
            className="full-calendar-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <FullCalendar
              firstDay={1}
              ref={calendarRef}
              initialDate={date}
              plugins={[interactionPlugin, dayGridPlugin]}
              initialView="dayGridMonth"
              editable={false}
              showNonCurrentDates={false}
              fixedWeekCount={false}
              selectable={true}
              eventClick={handleEventSelect}
              events={events}
              eventColor={colorMap[theme].accentColor}
              eventTextColor={colorMap[theme].textColor}
              eventContent={renderEventContent}
              headerToolbar={false}
              datesSet={handleDatesSet}
              height="auto"
              dayCellClassNames="hover:bg-muted/30 transition-colors duration-200"
              dayHeaderClassNames="font-semibold text-foreground bg-transparent"
              moreLinkClassNames="text-primary hover:text-primary/80 transition-colors"
            />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {!data.filtered && (
          <div className="w-full h-full">
            <Month month={currentMonth} />
          </div>
        )}

        <Card className="border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Most Expensive Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MostExpensiveProductDisplay />
          </CardContent>
        </Card>
      </div>
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Delete Transaction
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              Are you sure you want to delete this transaction? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              // @ts-expect-error
              onClick={() => handleDelete(showDeleteModal, token)}
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Delete
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              Edit Transaction
            </DialogTitle>
            <DialogDescription>
              Update the details for this transaction.
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
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowModal(false);
            setSelectedEvent(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">
              {
                // @ts-expect-error
                selectedEvent?.title
              }
            </DialogTitle>
            <DialogDescription>Transactions for this date</DialogDescription>
          </DialogHeader>
          <TransactionsTable
            isModal={true}
            handleEdit={handleEdit}
            // @ts-expect-error
            setShowDeleteModal={handleDelete}
            // @ts-expect-error
            items={selectedEvent?.data ? selectedEvent.data : []}
            changedItems={data.changedItems}
            handleClearChangedItem={handleClearChangedItem}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExpenseCalendar;
