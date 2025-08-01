import React, { useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { deleteNode, fetchData, formatNumber } from '@utils/utils';
import Modal from '@components/Modal';
import TransactionForm from '@components/TransactionForm';
import TransactionsTable from '@components/TransactionsTable';
import { ExpenseCalendar } from '@components/Calendar';
import Filters from '@components/Filters';
import { monthNames, notificationType } from '@utils/constants';
import {
  FaArrowLeft,
  FaArrowRight,
  FaTable,
  FaCalendar,
  FaTrash,
} from 'react-icons/fa';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import { NumberDisplay } from '@components/Home';

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
    <div>
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
            <FaTrash />
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
      <h2>{currentMonth || 'Expenses'}</h2>
      <Filters />
      {loading ? (
        <div className="lds-ripple">
          <div></div>
          <div></div>
        </div>
      ) : noData ? (
        ''
      ) : (
        <div>
          {Object.keys(items.groupedData).length ? (
            <>
              <div className="month-stats">
                <div>
                  <div
                    className="stats-container has-budget"
                    // @ts-expect-error TBC
                    style={{ '--budget-progress': `${monthPercentage}%` }}
                  >
                    <h3>Spent</h3>
                    <div className="stat-value">
                      <NumberDisplay number={total} />
                    </div>
                    {isMonthBudget && (
                      <div>of {formatNumber(monthlyBudget)}</div>
                    )}
                  </div>
                </div>
                {income > 0 && (
                  <div>
                    <div className="stats-container">
                      <h3>Income</h3>
                      <div className="stat-value">
                        <NumberDisplay number={income} />
                      </div>
                    </div>
                  </div>
                )}
                {income > 0 && (
                  <div>
                    <div className="stats-container">
                      <h3>Profit</h3>
                      <div className="stat-value">
                        <NumberDisplay number={profit} />
                      </div>
                    </div>
                  </div>
                )}
                {isWeekBudget ? (
                  <div>
                    <div
                      className="stats-container has-budget"
                      style={{
                        // @ts-expect-error TBC
                        '--budget-progress': `${weekPercentage}%`,
                      }}
                    >
                      <h3>Week budget</h3>
                      <div className="stat-value">
                        <NumberDisplay number={totalSumForCategory} />
                      </div>
                      <div>of {formatNumber(weeklyBudget)}</div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="tab-buttons">
                <div className="tabs-titles">
                  <div
                    onClick={() => setActiveTab('table')}
                    className={
                      activeTab === 'table' ? 'tab-title active' : 'tab-title'
                    }
                    aria-label="Table View"
                  >
                    <FaTable />
                  </div>
                  <div
                    onClick={() => setActiveTab('calendar')}
                    className={
                      activeTab === 'calendar'
                        ? 'tab-title active'
                        : 'tab-title'
                    }
                    aria-label="Calendar View"
                  >
                    <FaCalendar />
                  </div>
                </div>
              </div>
              {activeTab === 'calendar' ? (
                <ExpenseCalendar
                  items={items.groupedData[currentMonth]}
                  months={months}
                  setCurrentMonthIndex={handleMonthChange}
                  currentMonthIndex={currentMonthIndex}
                  currentMonth={currentMonth}
                />
              ) : (
                <>
                  <TransactionsTable
                    items={items.groupedData[currentMonth]}
                    handleEdit={handleEdit}
                    // @ts-expect-error
                    setShowDeleteModal={setShowDeleteModal}
                    changedItems={data.changedItems}
                    handleClearChangedItem={handleClearChangedItem}
                  />
                  <div className="pager-navigation">
                    <button
                      disabled={!months[currentMonthIndex + 1]}
                      onClick={() =>
                        setCurrentMonthIndex(currentMonthIndex + 1)
                      }
                    >
                      <FaArrowLeft />
                    </button>
                    <button
                      disabled={!months[currentMonthIndex - 1]}
                      onClick={() =>
                        setCurrentMonthIndex(currentMonthIndex - 1)
                      }
                    >
                      <FaArrowRight />
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <p>No transaction records found.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Home;
