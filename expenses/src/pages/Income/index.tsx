import React, { useEffect, useState, useMemo } from 'react';
import IncomeForm from '@components/Income/IncomeForm';
import { deleteNode, formatNumber, getMonthsPassed } from '@utils/utils';
import { useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import Modal from '@components/Modal/Modal';
import IncomeTable from '@components/Income/IncomeTable';
import IncomeFilters from '@components/Income/IncomeFilters';
import YearIncomeAverageTrend from '@components/Income/YearIncomeAverageTrend';
import {
  PageHeader,
  LoadingSpinner,
  StatCard,
  StatsGrid,
  DeleteConfirmModal,
  NoData,
} from '@components/Common';
import { notificationType } from '@utils/constants';
import { AuthState, TransactionOrIncomeItem } from '@type/types';
import {
  FiPlus,
  FiChevronDown,
  FiDollarSign,
  FiTrendingUp,
} from 'react-icons/fi';
import './Income.scss';
import { fetchExpenses as fetchExpensesService } from '@api/expenses';
import { useApiClient } from '@hooks/useApiClient';

const Income = () => {
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState() as AuthState;
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const [incomeFormSubmitting, setIncomeFormSubmitting] = useState(false);
  const { data, dataDispatch } = useData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(20);
  const [filters, setFilters] = useState({
    textFilter: '',
    selectedMonth: '',
  });
  const apiClient = useApiClient();

  useEffect(() => {
    if (noData && apiClient) {
      fetchExpensesService(apiClient, dataDispatch);
    }
  }, [data, dataDispatch, noData, apiClient]);

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
    deleteNode(
      id,
      token,
      (response) => {
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
        // Don't fetch - UI already updated by deleteNode
      },
      dataDispatch
    );
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
      <div className="page-container">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-container income-page">
      {/* Header */}
      <PageHeader
        title={t('income.title')}
        subtitle={`${totalRecords} ${totalRecords === 1 ? t('income.incomeRecord') : t('income.incomeRecords')}`}
      />

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
      <StatsGrid
        columns={2}
        filtered={!!(filters.textFilter || filters.selectedMonth)}
      >
        <StatCard
          icon={<FiDollarSign />}
          value={formatNumber(totalIncome)}
          label={t('income.totalIncome')}
        />
        {!filters.textFilter && !filters.selectedMonth && (
          <StatCard
            icon={<FiTrendingUp />}
            value={formatNumber(averageIncome)}
            label={t('income.averageIncome')}
          />
        )}
      </StatsGrid>

      {/* Income Table Section */}
      <div className="income-table-section">
        {noData ? (
          <NoData
            icon={<FiDollarSign />}
            title={t('income.noIncome')}
            description={t('income.noIncomeDesc')}
          />
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
              <NoData
                icon={<FiDollarSign />}
                title={t('income.noIncome')}
                description={t('income.noIncomeDesc')}
              />
            )}

            {filteredIncomeData?.length > nrOfItemsToShow && (
              <div className="load-more">
                <button
                  onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                  className="load-more-btn"
                >
                  <FiChevronDown />
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
      <DeleteConfirmModal
        show={!!showDeleteModal}
        onClose={(e) => {
          e.preventDefault();
          setShowDeleteModal(false);
        }}
        onConfirm={() =>
          showDeleteModal && handleDelete(showDeleteModal, token)
        }
        title={t('income.deleteIncome')}
        isSubmitting={isSubmitting}
      />

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
        footer={
          <button
            type="submit"
            form={`income-form-${!isNewModal ? 'edit' : 'add'}`}
            disabled={incomeFormSubmitting}
            className="btn-submit"
          >
            {incomeFormSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : !isNewModal ? (
              t('common.save')
            ) : (
              t('common.add')
            )}
          </button>
        }
      >
        <IncomeForm
          formType={!isNewModal ? 'edit' : 'add'}
          values={focusedItem}
          hideSubmitButton={true}
          onFormReady={(submitHandler, isSubmitting) => {
            setIncomeFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setIsNewModal(false);
            // Optimistic UI already applied by useFormSubmit; refetch not needed
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
        <FiPlus />
      </button>
    </div>
  );
};

export default Income;
