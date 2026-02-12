import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import IncomeForm from '@features/incomes/components/Income/IncomeForm';
import {
  deleteNode,
  formatNumber,
  getMonthsInRange,
  getMonthsPassed,
  hasTag,
} from '@shared/utils/utils';
import { useAuthState } from '@shared/context/context';
import { useExpenseData } from '@stores/expenseStore';
import { useNotification } from '@shared/context/notification';
import { useLocalization } from '@shared/context/localization';
import { useChartsThemeSync } from '@shared/context/highcharts';
import VaulDrawer from '@shared/components/VaulDrawer';
import IncomeTable from '@features/incomes/components/Income/IncomeTable';
import IncomeFilters from '@features/incomes/components/Income/IncomeFilters';
import YearIncomeAverageTrend from '@features/incomes/components/Income/YearIncomeAverageTrend';
import IncomeIntelligence from '@features/incomes/components/Income/IncomeIntelligence';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import {
  PageHeader,
  LoadingSpinner,
  StatCard,
  StatsGrid,
  DeleteConfirmDrawer,
  NoData,
} from '@shared/components/Common';
import { PAGE_CONTAINER_CLASS } from '@shared/utils/layoutClasses';
import { notificationType } from '@shared/utils/constants';
import { TransactionOrIncomeItem } from '@shared/type/types';
import {
  FiPlus,
  FiEdit2,
  FiChevronDown,
  FiDollarSign,
  FiTrendingUp,
} from 'react-icons/fi';
import { fetchExpenses as fetchExpensesService } from '@features/expenses/api/expenses';
import { useApiClient } from '@shared/hooks/useApiClient';

const Income = () => {
  useChartsThemeSync();
  const showNotification = useNotification();
  const { t } = useLocalization();
  const { token } = useAuthState();
  const [showDeleteModal, setShowDeleteModal] = useState<string | false>(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isNewModal, setIsNewModal] = useState(false);
  const [incomeFormSubmitting, setIncomeFormSubmitting] = useState(false);
  const { data, dataDispatch } = useExpenseData();
  const noData = data.groupedData === null;
  const loading = data.loading;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nrOfItemsToShow, setNrOfItemsToShow] = useState(10);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<{
    textFilter: string;
    selectedMonth: string;
    selectedTag: string;
    dateRange: { start: string; end: string } | null;
  }>({
    textFilter: '',
    selectedMonth: '',
    selectedTag: '',
    dateRange: null,
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

      // Date range filter
      if (filters.dateRange?.start && filters.dateRange?.end) {
        if (!item.dt) return false;
        const y = new Date(item.dt).getFullYear();
        const m = String(new Date(item.dt).getMonth() + 1).padStart(2, '0');
        const d = String(new Date(item.dt).getDate()).padStart(2, '0');
        const itemDate = `${y}-${m}-${d}`;
        if (itemDate < filters.dateRange.start || itemDate > filters.dateRange.end) return false;
      }

      return true;
    });
  }, [data.incomeData, filters]);

  const handleFilterChange = useCallback(
    (newFilters: {
      textFilter: string;
      selectedMonth: string;
      selectedTag: string;
      dateRange?: { start: string; end: string } | null;
    }) => {
      setFilters((prev) => {
        const hasFilterChanged =
          newFilters.textFilter !== prev.textFilter ||
          newFilters.selectedMonth !== prev.selectedMonth ||
          newFilters.selectedTag !== prev.selectedTag ||
          (newFilters.dateRange !== undefined && JSON.stringify(newFilters.dateRange) !== JSON.stringify(prev.dateRange));

        if (hasFilterChanged) {
          setNrOfItemsToShow(20);
        }

        return {
          textFilter: newFilters.textFilter,
          selectedMonth: newFilters.selectedMonth,
          selectedTag: newFilters.selectedTag,
          dateRange: newFilters.dateRange !== undefined ? newFilters.dateRange : prev.dateRange,
        };
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

  const months = useMemo(() => {
    if (filters.dateRange?.start && filters.dateRange?.end) {
      return getMonthsInRange(filters.dateRange.start, filters.dateRange.end);
    }
    if (filters.selectedMonth) return 1;
    const firstDay = data.raw[data.raw.length - 1]?.dt;
    return firstDay
      ? parseFloat(getMonthsPassed(firstDay as string).toFixed(2))
      : 1;
  }, [filters.dateRange, filters.selectedMonth, data.raw]);

  const averageIncome = totalIncome / Math.max(1, months);

  if (loading) {
    return (
      <div className={PAGE_CONTAINER_CLASS}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      {/* Header */}
      <PageHeader
        title={t('income.title')}
        subtitle={
          filters.textFilter || filters.selectedMonth || filters.selectedTag || (filters.dateRange?.start && filters.dateRange?.end)
            ? `${totalRecords} ${totalRecords === 1 ? t('income.incomeRecord') : t('income.incomeRecords')}`
            : `${data.incomeData?.length || 0} ${(data.incomeData?.length || 0) === 1 ? t('income.incomeRecord') : t('income.incomeRecords')}`
        }
      />

      {/* Filters */}
      <IncomeFilters
        textFilter={filters.textFilter}
        selectedMonth={filters.selectedMonth}
        selectedTag={filters.selectedTag}
        dateRange={filters.dateRange}
        onTextFilterChange={(textFilter) =>
          handleFilterChange({ ...filters, textFilter })
        }
        onMonthFilterChange={(selectedMonth) =>
          handleFilterChange({ ...filters, selectedMonth })
        }
        onTagFilterChange={(selectedTag) =>
          handleFilterChange({ ...filters, selectedTag })
        }
        onDateRangeChange={(dateRange) =>
          handleFilterChange({ ...filters, dateRange })
        }
        onClearFilters={() =>
          handleFilterChange({
            textFilter: '',
            selectedMonth: '',
            selectedTag: '',
            dateRange: null,
          })
        }
        onFilterPanelOpenChange={setFilterPanelOpen}
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
      <div className="mb-8">
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
              <div className="flex justify-center items-center py-4 mt-2">
                <button
                  type="button"
                  onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[var(--color-app-accent)]/20 border border-[var(--color-app-accent)]/40 text-[var(--color-app-accent)] text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 hover:bg-[var(--color-app-accent)]/30 hover:border-[var(--color-app-accent)]/50 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&_svg]:text-sm"
                >
                  <FiChevronDown />
                  <span>
                    {t('common.loadMore')} ({filteredIncomeData.length - nrOfItemsToShow} {t('common.remaining')})
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Charts Section */}
      {data.incomeData?.length ? (
        <>
          <div className="mb-8">
            <YearIncomeAverageTrend
              filteredIncomeData={filteredIncomeData}
              isFiltered={
                !!(
                  filters.textFilter ||
                  filters.selectedMonth ||
                  filters.selectedTag ||
                  (filters.dateRange?.start && filters.dateRange?.end)
                )
              }
            />
          </div>
          {filteredIncomeData && filteredIncomeData.length ? (
            <div className="mb-8">
              <IncomeIntelligence />
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
              <>
                <FiEdit2 />
                <span>{t('incomeForm.editIncome')}</span>
              </>
            ) : (
              <>
                <FiPlus />
                <span>{t('incomeForm.addIncome')}</span>
              </>
            )}
          </button>
        }
      >
        <IncomeForm
          formType={!isNewModal ? 'edit' : 'add'}
          // Pentru „Add income” nu vrem să preluăm datele ultimei intrări selectate.
          // Când isNewModal === true, trimitem valori goale ca să folosim initialState (data = azi).
          values={isNewModal ? {} : focusedItem}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, isSubmitting) => {
            setIncomeFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setIsNewModal(false);
            // Optimistic UI already applied by useFormSubmit; refetch not needed
          }}
        />
      </VaulDrawer>

      {/* FAB - hidden when filter panel is open to avoid overlap */}
      {!filterPanelOpen && (
        <button
          onClick={() => {
            setShowEditModal(true);
            setIsNewModal(true);
          }}
          className="fab"
          title={t('incomeForm.addIncome')}
        >
          <FiPlus />
        </button>
      )}
    </div>
  );
};

export default Income;
