import React, { useEffect, useState } from 'react';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
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
  FaPlus,
} from 'react-icons/fa';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import { NumberDisplay } from '@components/Home';
import './Home.scss';

const Home = () => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState() as AuthState;
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
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

  const handleDelete = (id: string, token: string) => {
    setIsSubmitting(true);
    deleteNode(id, token, (response: Response) => {
      if (response.ok) {
        showNotification(
          t('notification.transactionDeleted'),
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification(t('error.unknown'), notificationType.ERROR);
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
  const currentMonth = months[currentMonthIndex] || months[0] || '';

  // Only set initial month index when data first loads
  useEffect(() => {
    if (months.length > 0 && currentMonthIndex === 0) {
      setCurrentMonthIndex(0);
    }
  }, [months.length]);

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
    <div className="home">
      <Modal
        show={!!showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
      >
        <h3>{t('modal.deleteTransaction')}</h3>
        <p
          style={{
            textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '1.5rem',
          }}
        >
          {t('modal.deleteMessage')}
        </p>
        <button
          onClick={() =>
            showDeleteModal && handleDelete(showDeleteModal, token)
          }
          className="button danger wide"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <div className="loader">
              <span className="loader__element"></span>
              <span className="loader__element"></span>
              <span className="loader__element"></span>
            </div>
          ) : (
            <>
              <FaTrash />
              {t('common.delete')}
            </>
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
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
        }}
      >
        <TransactionForm
          formType="add"
          values={{}}
          onSuccess={() => {
            setShowAddModal(false);
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

      {/* Simple Header */}
      <h2>{currentMonth || t('home.title')}</h2>

      <Filters />
      {loading ? (
        <div className="loading-container">
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
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
                    style={
                      {
                        '--budget-progress': `${monthPercentage}%`,
                      } as React.CSSProperties
                    }
                  >
                    <h3>{t('common.total')}</h3>
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
                      <h3>{t('nav.income')}</h3>
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
                      style={
                        {
                          '--budget-progress': `${weekPercentage}%`,
                        } as React.CSSProperties
                      }
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
                    aria-label={t('common.actions')}
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
                    aria-label={t('common.date')}
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
                    setShowDeleteModal={(id: string) => setShowDeleteModal(id)}
                    changedItems={data.changedItems}
                    handleClearChangedItem={handleClearChangedItem}
                  />
                  <div className="pager-navigation">
                    <button
                      disabled={currentMonthIndex >= months.length - 1}
                      onClick={() =>
                        setCurrentMonthIndex(currentMonthIndex + 1)
                      }
                    >
                      <FaArrowLeft />
                    </button>
                    <button
                      disabled={currentMonthIndex <= 0}
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
            <p>{t('home.noData')}</p>
          )}
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="home fab"
        title={t('transactionForm.addTransaction')}
      >
        <FaPlus />
      </button>
    </div>
  );
};

export default Home;
