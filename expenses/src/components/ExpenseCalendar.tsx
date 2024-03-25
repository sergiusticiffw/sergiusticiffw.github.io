import React, { useState, useEffect } from 'react';
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
import { deleteNode, fetchData } from '../utils/utils';
import { notificationType } from '../utils/constants';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';

const ExpenseCalendar = () => {
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

  const handleEdit = (id: string) => {
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

  const groupByDate = (transactions: TransactionOrIncomeItem[]) => {
    const groupedTransactions = (transactions ?? []).reduce(
      (acc, transaction) => {
        const { type, dt: date, sum } = transaction;
        if (type === 'transaction') {
          const parsedSum = parseFloat(sum);
          if (!acc[date]) {
            acc[date] = parsedSum;
          } else {
            acc[date] += parsedSum;
          }
        }
        return acc;
      },
      {}
    );

    return Object.keys(groupedTransactions).map((date) => ({
      date,
      sum: groupedTransactions[date],
    }));
  };

  const getTransactionsByDate = (id: string) => {
    return (items ?? [])?.filter(
      (item: TransactionOrIncomeItem) =>
        item.dt === id && item.type === 'transaction'
    );
  };

  useEffect(() => {
    // Process expense data to format it for the calendar
    const formattedEvents = (groupByDate(items) ?? []).map((expense) => ({
      id: expense.date,
      title: expense.sum,
      allDay: true,
      start: new Date(expense.date),
      end: new Date(expense.date),
    }));
    setEvents(formattedEvents);
  }, [items]);

  const handleEventSelect = (event) => {
    const selectedItems = getTransactionsByDate(event.event.id);
    const date = new Date(event.event.id);
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    setSelectedEvent({
      title: formattedDate,
      data: selectedItems,
    });
    setShowModal(true);
  };

  const [id, setId] = useState('');

  const handleDelete = (idToRemove: string, token: string) => {
    setId(idToRemove);
    setShowModal(false);
    setShowDeleteModal(true);
    if (idToRemove && showDeleteModal) {
      setIsSubmitting(true);
      deleteNode(id, token, (response: Response) => {
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

  const renderEventContent = (eventInfo) => {
    return <>{eventInfo.event.title}</>;
  };

  return (
    <>
      <FullCalendar
        plugins={[interactionPlugin, dayGridPlugin]}
        initialView="dayGridMonth"
        editable={false}
        selectable={true}
        eventClick={handleEventSelect}
        events={events}
        eventColor="#378006"
        eventContent={renderEventContent}
      />
      <Modal
        show={showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
      >
        <h3>Are you sure you want to delete the transaction?</h3>
        <button
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
        <span className="heading">{selectedEvent?.title}</span>
        <TransactionsTable
          handleEdit={handleEdit}
          setShowDeleteModal={handleDelete}
          items={selectedEvent?.data ? selectedEvent.data : []}
        />
      </Modal>
    </>
  );
};

export default ExpenseCalendar;
