import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  useAuthDispatch,
  useAuthState,
  useData,
  useNotification,
} from '../context';
import Modal from './Modal';
import TransactionsTable from './TransactionsTable';
import { AuthState, TransactionOrIncomeItem, DataState } from '../type/types';
import TransactionForm from './TransactionForm';
import { deleteNode, fetchData, formatNumber } from '../utils/utils';
import { notificationType } from '../utils/constants';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

interface ExpenseCalendarProps {
  currentMonthIndex: number;
  setCurrentMonthIndex: (newMonthIndex: number) => void;
}

const ExpenseCalendar: React.FC<ExpenseCalendarProps> = ({
  setCurrentMonthIndex,
  currentMonthIndex,
}) => {
  const { data, dataDispatch } = useData() as DataState;
  const items = data.filtered_raw || data.raw;
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

  const renderEventContent = useCallback((eventInfo: { event: { title: string } }) => {
    return <>{formatNumber(eventInfo.event.title)}</>;
  }, []);

  const calendarRef = useRef(null);
  const transactions = data.filtered || data;
  const months = transactions.groupedData
    ? Object.keys(transactions.groupedData)
    : [];
  const date = new Date(`01 ${months[currentMonthIndex]}`);

  useEffect(() => {
    if (calendarRef.current) {
      // @ts-expect-error
      calendarRef.current.getApi().gotoDate(date);
    }
  }, [date]);

  const handleNextButtonClick = () => {
    setCurrentMonthIndex(currentMonthIndex - 1);
    // @ts-expect-error
    const calendarApi = calendarRef.current.getApi();
    calendarApi.next();
  };

  const handlePrevButtonClick = () => {
    setCurrentMonthIndex(currentMonthIndex + 1);
    // @ts-expect-error
    const calendarApi = calendarRef.current.getApi();
    calendarApi.prev();
  };

  const handleTodayButtonClick = () => {
    setCurrentMonthIndex(0);
    // @ts-expect-error
    const calendarApi = calendarRef.current.getApi();
    calendarApi.gotoDate(new Date());
  };

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

  const handleTouchStart = (event) => {
    touchStartX = event.touches[0].clientX;
  };

  const handleTouchMove = (event) => {
    touchEndX = event.touches[0].clientX;
    isSwiping = true;
  };

  const handleTouchEnd = () => {
    if (isSwiping) {
      const deltaX = touchEndX - touchStartX;
      const threshold = 50;
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          if (prevDisabled) return;
          setCurrentMonthIndex(currentMonthIndex + 1);
          calendarRef.current.getApi().prev();
        } else {
          if (nextDisabled) return;
          setCurrentMonthIndex(currentMonthIndex - 1);
          calendarRef.current.getApi().next();
        }
      }
    }
    isSwiping = false;
  };

  return (
    <>
      <div className="calendar-container">
        <div
          className="full-calendar-container"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <FullCalendar
            ref={calendarRef}
            initialDate={date}
            plugins={[interactionPlugin, dayGridPlugin]}
            initialView="dayGridMonth"
            editable={false}
            selectable={true}
            eventClick={handleEventSelect}
            events={events}
            eventContent={renderEventContent}
            headerToolbar={{
              left: '',
              center: '',
              right: '',
            }}
            datesSet={handleDatesSet}
          />
        </div>
        <div>
          <button
            disabled={prevDisabled}
            className="button prev-btn desktop-only"
            onClick={handlePrevButtonClick}
          >
            Previous
          </button>
          <button
            disabled={nextDisabled}
            className="button next-btn desktop-only"
            onClick={handleNextButtonClick}
          >
            Next
          </button>
          <button
            disabled={todayDisabled}
            className="button today-btn desktop-only"
            onClick={handleTodayButtonClick}
          >
            Today
          </button>
        </div>
      </div>
      <Modal
        show={showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
      >
        <h3>Are you sure you want to delete the transaction?</h3>
        <button
          // @ts-expect-error
          onClick={() => handleDelete(showDeleteModal, token)}
          className="button wide"
        >
          {isSubmitting ? (
            <div className="loader">
              <span className="loader__element"></span>
              <span className="loader__element"></span>
              <span className="loader__element"></span>
            </div>
          ) : (
            'Yes, remove the transaction'
          )}
        </button>
      </Modal>
      <Modal
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
        }}
      >
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
      </Modal>
      <Modal
        show={showModal}
        onClose={(e) => {
          e.preventDefault();
          setShowModal(false);
          setSelectedEvent(null);
        }}
      >
        <span className="heading">
          {
            // @ts-expect-error
            selectedEvent?.title
          }
        </span>
        <TransactionsTable
          isModal={true}
          handleEdit={handleEdit}
          // @ts-expect-error
          setShowDeleteModal={handleDelete}
          // @ts-expect-error
          items={selectedEvent?.data ? selectedEvent.data : []}
        />
      </Modal>
    </>
  );
};

export default ExpenseCalendar;
