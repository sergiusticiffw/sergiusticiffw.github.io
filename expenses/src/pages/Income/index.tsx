import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  Suspense,
} from 'react';
import IncomeForm from '@components/Income/IncomeForm';
import {
  deleteNode,
  formatNumber,
  getMonthsPassed,
  hasTag,
} from '@utils/utils';
import { useAuthState, useData } from '@context/context';
import { useNotification } from '@context/notification';
import { useLocalization } from '@context/localization';
import VaulDrawer from '@components/VaulDrawer';
import IncomeTable from '@components/Income/IncomeTable';
import IncomeFilters from '@components/Income/IncomeFilters';
import YearIncomeAverageTrend from '@components/Income/YearIncomeAverageTrend';
import { usePendingSyncIds } from '@hooks/usePendingSyncIds';

const IncomeIntelligence = React.lazy(
  () => import('@components/IncomeIntelligence')
);
import {
  PageHeader,
  LoadingSpinner,
  StatCard,
  StatsGrid,
  DeleteConfirmDrawer,
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
    selectedTag: '',
  });
  const apiClient = useApiClient();

  // Event-driven pending sync tracking (no polling)
  const pendingSyncIds = usePendingSyncIds(['income']);

  useEffect(() => {
    if (noData && apiClient) {
      fetchExpensesService(apiClient, dataDispatch);
    }
  }, [noData, apiClient, dataDispatch]);

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

      // Tag filter
      if (filters.selectedTag) {
        if (!hasTag(item, filters.selectedTag)) {
          return false;
        }
      }

      return true;
    });
  }, [data.incomeData, filters]);

  const handleFilterChange = useCallback(
    (newFilters: {
      textFilter: string;
      selectedMonth: string;
      selectedTag: string;
    }) => {
      setFilters((prev) => {
        const hasFilterChanged =
          newFilters.textFilter !== prev.textFilter ||
          newFilters.selectedMonth !== prev.selectedMonth ||
          newFilters.selectedTag !== prev.selectedTag;

        if (hasFilterChanged) {
          setNrOfItemsToShow(20);
        }

        return newFilters;
      });
    },
    []
  );

  const handleEdit = useCallback(
    (id: string) => {
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
    },
    [data.incomeData]
  );

  const handleDelete = useCallback(
    (id: string, token: string) => {
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
    },
    [dataDispatch, showNotification, t]
  );

  const handleClearChangedItem = useCallback(
    (id: string) => {
      dataDispatch({ type: 'CLEAR_CHANGED_ITEM', id });
    },
    [dataDispatch]
  );

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
        subtitle={
          filters.textFilter || filters.selectedMonth || filters.selectedTag
            ? `${totalRecords} ${totalRecords === 1 ? t('income.incomeRecord') : t('income.incomeRecords')}`
            : `${data.incomeData?.length || 0} ${(data.incomeData?.length || 0) === 1 ? t('income.incomeRecord') : t('income.incomeRecords')}`
        }
      />

      {/* Filters */}
      <IncomeFilters
        textFilter={filters.textFilter}
        selectedMonth={filters.selectedMonth}
        selectedTag={filters.selectedTag}
        onTextFilterChange={(textFilter) =>
          handleFilterChange({ ...filters, textFilter })
        }
        onMonthFilterChange={(selectedMonth) =>
          handleFilterChange({ ...filters, selectedMonth })
        }
        onTagFilterChange={(selectedTag) =>
          handleFilterChange({ ...filters, selectedTag })
        }
        onClearFilters={() =>
          handleFilterChange({
            textFilter: '',
            selectedMonth: '',
            selectedTag: '',
          })
        }
      />

      {/* Income Stats Cards */}
      <StatsGrid columns={2} filtered={false}>
        <StatCard
          icon={<FiDollarSign />}
          value={formatNumber(totalIncome)}
          label={t('income.totalIncome')}
        />
        <StatCard
          icon={<FiTrendingUp />}
          value={formatNumber(averageIncome)}
          label={t('income.averageIncome')}
        />
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
                pendingSyncIds={pendingSyncIds}
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
                  {t('common.loadMore')}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Charts Section */}
      {data.incomeData?.length ? (
        <>
          <div className="charts-section">
            <YearIncomeAverageTrend
              filteredIncomeData={filteredIncomeData}
              isFiltered={
                !!(
                  filters.textFilter ||
                  filters.selectedMonth ||
                  filters.selectedTag
                )
              }
            />
          </div>
          {filteredIncomeData && filteredIncomeData.length ? (
            <div className="charts-section">
              <Suspense fallback="">
                <IncomeIntelligence />
              </Suspense>
            </div>
          ) : null}
        </>
      ) : null}

      {/* Delete Confirmation Drawer */}
      <DeleteConfirmDrawer
        open={!!showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={() =>
          showDeleteModal && handleDelete(showDeleteModal, token)
        }
        title={t('income.deleteIncome')}
        isSubmitting={isSubmitting}
      />

      <VaulDrawer
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
      </VaulDrawer>

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
