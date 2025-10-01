import React, { Suspense, useEffect, useState, useMemo } from 'react';
import IncomeForm from '@components/Income/IncomeForm';
import {
  deleteNode,
  fetchData,
  formatNumber,
  getMonthsPassed,
} from '@utils/utils';
import { useAuthDispatch, useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import Modal from '@components/Modal/Modal';
import IncomeTable from '@components/Income/IncomeTable';
import IncomeFilters from '@components/Income/IncomeFilters';
import YearIncomeAverageTrend from '@components/Income/YearIncomeAverageTrend';
import { notificationType } from '@utils/constants';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import {
  FaPlus,
  FaTrash,
  FaCaretDown,
  FaMoneyBillWave,
  FaChartLine,
} from 'react-icons/fa';
import './Income.scss';

const Income = () => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState() as AuthState;
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const dispatch = useAuthDispatch();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(20);
  const [filters, setFilters] = useState({
    textFilter: '',
    selectedMonth: '',
  });

  useEffect(() => {
    if (noData) {
      fetchData(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

  const [focusedItem, setFocusedItem] = useState({
    nid: '',
    field_date: '',
    field_amount: '',
    field_description: '',
  });

  // Filter income data based on current filters
  const filteredIncomeData = useMemo(() => {
    if (!data.incomeData) return [];

    return data.incomeData.filter((item: TransactionOrIncomeItem) => {
      // Text filter
      if (
        filters.textFilter &&
        !item.dsc.toLowerCase().includes(filters.textFilter.toLowerCase())
      ) {
        return false;
      }

      // Month filter
      if (filters.selectedMonth) {
        const itemDate = new Date(item.dt);
        const selectedDate = new Date(filters.selectedMonth + '-01'); // Add day to make it a valid date

        const itemYear = itemDate.getFullYear();
        const itemMonth = itemDate.getMonth();
        const selectedYear = selectedDate.getFullYear();
        const selectedMonth = selectedDate.getMonth();

        if (itemYear !== selectedYear || itemMonth !== selectedMonth) {
          return false;
        }
      }

      return true;
    });
  }, [data.incomeData, filters]);

  const handleFilterChange = (newFilters: {
    textFilter: string;
    selectedMonth: string;
  }) => {
    setFilters(newFilters);
    // Only reset pagination if filters actually changed
    const hasFilterChanged =
      newFilters.textFilter !== filters.textFilter ||
      newFilters.selectedMonth !== filters.selectedMonth;

    if (hasFilterChanged) {
      setNrOfItemsToShow(20);
    }
  };

  const handleEdit = (id: string) => {
    const item = data.incomeData.find(
      (item: TransactionOrIncomeItem) => item.id === id
    );
    setFocusedItem({
      nid: item.id,
      field_date: item.dt,
      field_amount: item.sum,
      field_description: item.dsc,
    });
    setShowEditModal(true);
  };

  const handleDelete = (id: string, token: string) => {
    setIsSubmitting(true);
    deleteNode(id, token, (response) => {
      if (response.ok) {
        showNotification(
          t('notification.incomeDeleted'),
          notificationType.SUCCESS
        );
        setIsSubmitting(false);
      } else {
        showNotification(t('error.unknown'), notificationType.ERROR);
        setIsSubmitting(false);
      }
      setShowDeleteModal(false);
      fetchData(token, dataDispatch, dispatch);
    });
  };

  const handleClearChangedItem = (id: string) => {
    dataDispatch({ type: 'CLEAR_CHANGED_ITEM', id });
  };

  // Calculate income statistics based on filtered data
  const totalIncome =
    filteredIncomeData?.reduce(
      (sum: number, item: TransactionOrIncomeItem) =>
        sum + parseFloat(item.sum || '0'),
      0
    ) || 0;
  const totalRecords = filteredIncomeData?.length || 0;
  const firstDay = data.raw[data.raw.length - 1]?.dt;
  const months = firstDay
    ? parseFloat(getMonthsPassed(firstDay as string).toFixed(2))
    : 1;
  const averageIncome = totalIncome / months;

  if (loading) {
    return (
      <div className="income-page">
        <div className="income-loading">
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="income-page">
      {/* Header - exact same structure as Home1 */}
      <div className="income-header">
        <h1>{t('income.title')}</h1>
        <p className="transaction-count">
          {totalRecords}{' '}
          {totalRecords === 1 ? 'income record' : 'income records'}
        </p>
      </div>

      {/* Filters */}
      <IncomeFilters
        textFilter={filters.textFilter}
        selectedMonth={filters.selectedMonth}
        onTextFilterChange={(textFilter) =>
          handleFilterChange({ ...filters, textFilter })
        }
        onMonthFilterChange={(selectedMonth) =>
          handleFilterChange({ ...filters, selectedMonth })
        }
        onClearFilters={() =>
          handleFilterChange({ textFilter: '', selectedMonth: '' })
        }
      />

      {/* Income Stats Cards */}
      <div className="home1-stats-grid">
        <div className="home1-stat-card">
          <div className="stat-icon">
            <FaMoneyBillWave />
          </div>
          <div className="stat-value">{formatNumber(totalIncome)}</div>
          <div className="stat-label">{t('income.totalIncome')}</div>
        </div>
        {!filters.textFilter && !filters.selectedMonth && (
          <div className="home1-stat-card">
            <div className="stat-icon">
              <FaChartLine />
            </div>
            <div className="stat-value">{formatNumber(averageIncome)}</div>
            <div className="stat-label">{t('income.averageIncome')}</div>
          </div>
        )}
      </div>

      {/* Income Table Section */}
      <div className="income-table-section">
        {noData ? (
          <div className="no-income">
            <FaMoneyBillWave />
            <h3>{t('income.noIncome')}</h3>
            <p>{t('income.noIncomeDesc')}</p>
          </div>
        ) : (
          <>
            {filteredIncomeData && filteredIncomeData.length ? (
              <IncomeTable
                items={filteredIncomeData.slice(0, nrOfItemsToShow)}
                handleEdit={handleEdit}
                setShowDeleteModal={setShowDeleteModal}
                changedItems={data.changedItems}
                handleClearChangedItem={handleClearChangedItem}
              />
            ) : (
              <div className="no-income">
                <FaMoneyBillWave />
                <h3>{t('income.noIncome')}</h3>
                <p>
                  {filters.textFilter || filters.selectedMonth
                    ? t('income.noIncomeDesc')
                    : t('income.noIncomeDesc')}
                </p>
              </div>
            )}

            {filteredIncomeData?.length > nrOfItemsToShow && (
              <div className="load-more">
                <button
                  onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                  className="load-more-btn"
                >
                  <FaCaretDown />
                  {t('common.loading')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Charts Section */}
      {data.incomeData?.length ? (
        <div>
          <YearIncomeAverageTrend />
        </div>
      ) : null}

      {/* Modals */}
      <Modal
        show={!!showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
        title={t('modal.deleteIncome')}
      >
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
          setIsNewModal(false);
        }}
        title={
          !isNewModal ? t('incomeForm.editIncome') : t('incomeForm.addIncome')
        }
      >
        <IncomeForm
          formType={!isNewModal ? 'edit' : 'add'}
          values={focusedItem}
          onSuccess={() => {
            setShowEditModal(false);
            setIsNewModal(false);
            fetchData(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      {/* Floating Action Button */}
      <button
        onClick={() => {
          setShowEditModal(true);
          setIsNewModal(true);
        }}
        className="fab"
        title={t('income.addIncome')}
      >
        <FaPlus />
      </button>
    </div>
  );
};

export default Income;
