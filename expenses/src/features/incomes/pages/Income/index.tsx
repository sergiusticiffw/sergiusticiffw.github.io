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
import CalendarView from '@features/expenses/components/CalendarView';
import YearIncomeAverageTrend from '@features/incomes/components/Income/YearIncomeAverageTrend';
import IncomeIntelligence from '@features/incomes/components/Income/IncomeIntelligence';
import IncomeExpensesPerYearBarChart from '@features/incomes/components/Income/IncomeExpensesPerYearBarChart';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import {
  PageHeader,
  Loader,
  LoadingSpinner,
  StatCard,
  StatsGrid,
  DeleteConfirmDrawer,
  NoData,
} from '@shared/components/Common';
import { PAGE_CONTAINER_CLASS, BTN_SUBMIT_CLASS, FAB_CLASS } from '@shared/utils/layoutClasses';
import { notificationType } from '@shared/utils/constants';
import { TransactionOrIncomeItem } from '@shared/type/types';
import {
  FiPlus,
  FiEdit2,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDollarSign,
  FiTrendingUp,
  FiList,
  FiCalendar,
} from 'react-icons/fi';

const ENGLISH_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const getMonthKey = (dt: string) => {
  const date = new Date(dt);
  return `${ENGLISH_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
};

const parseMonthKey = (monthKey: string) => {
  const [name, year] = monthKey.split(' ');
  const monthIndex = ENGLISH_MONTH_NAMES.indexOf(
    name as (typeof ENGLISH_MONTH_NAMES)[number]
  );
  return new Date(parseInt(year, 10), monthIndex, 1).getTime();
};
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
  const [activeView, setActiveView] = useState<'list' | 'calendar'>('list');
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState<{
    textFilter: string;
    selectedTag: string;
    dateRange: { start: string; end: string } | null;
  }>({
    textFilter: '',
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

  const groupedIncomeByMonth = useMemo(() => {
    const grouped: Record<string, TransactionOrIncomeItem[]> = {};
    filteredIncomeData.forEach((item: TransactionOrIncomeItem) => {
      if (!item.dt) return;
      const month = getMonthKey(item.dt);
      if (!grouped[month]) {
        grouped[month] = [];
      }
      grouped[month].push(item);
    });
    Object.values(grouped).forEach((items) => {
      items.sort(
        (a, b) => new Date(b.dt).getTime() - new Date(a.dt).getTime()
      );
    });
    return grouped;
  }, [filteredIncomeData]);

  const incomeMonths = useMemo(
    () =>
      Object.keys(groupedIncomeByMonth).sort(
        (a, b) => parseMonthKey(b) - parseMonthKey(a)
      ),
    [groupedIncomeByMonth]
  );

  useEffect(() => {
    if (incomeMonths.length > 0) {
      if (currentMonthIndex >= incomeMonths.length) {
        setCurrentMonthIndex(0);
      }
    } else {
      setCurrentMonthIndex(0);
    }
  }, [incomeMonths, currentMonthIndex]);

  const currentMonth = incomeMonths[currentMonthIndex] || incomeMonths[0] || '';
  const currentMonthIncome = groupedIncomeByMonth[currentMonth] || [];

  const hasActiveFilters = !!(
    filters.textFilter ||
    filters.selectedTag ||
    (filters.dateRange?.start && filters.dateRange?.end)
  );

  useEffect(() => {
    if (hasActiveFilters) {
      setCurrentMonthIndex(0);
    }
  }, [filters.textFilter, filters.selectedTag, filters.dateRange, hasActiveFilters]);

  const handleFilterChange = useCallback(
    (newFilters: {
      textFilter: string;
      selectedTag: string;
      dateRange?: { start: string; end: string } | null;
    }) => {
      setFilters((prev) => {
        const hasFilterChanged =
          newFilters.textFilter !== prev.textFilter ||
          newFilters.selectedTag !== prev.selectedTag ||
          (newFilters.dateRange !== undefined && JSON.stringify(newFilters.dateRange) !== JSON.stringify(prev.dateRange));

        if (hasFilterChanged) {
          setNrOfItemsToShow(20);
        }

        return {
          textFilter: newFilters.textFilter,
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
    const firstDay = data.raw[data.raw.length - 1]?.dt;
    return firstDay
      ? parseFloat(getMonthsPassed(firstDay as string).toFixed(2))
      : 1;
  }, [filters.dateRange, data.raw]);

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
        title={
          activeView === 'calendar' && currentMonth
            ? currentMonth
            : t('income.title')
        }
        subtitle={(() => {
          const count =
            activeView === 'calendar' && currentMonth
              ? currentMonthIncome.length
              : filters.textFilter ||
                  filters.selectedTag ||
                  (filters.dateRange?.start && filters.dateRange?.end)
                ? totalRecords
                : data.incomeData?.length || 0;
          return `${count} ${count === 1 ? t('income.incomeRecord') : t('income.incomeRecords')}`;
        })()}
      />

      {/* Filters */}
      <IncomeFilters
        textFilter={filters.textFilter}
        selectedTag={filters.selectedTag}
        dateRange={filters.dateRange}
        onTextFilterChange={(textFilter) =>
          handleFilterChange({ ...filters, textFilter })
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

      {!noData && (
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            className={`flex-1 rounded-xl py-3.5 px-4 text-[0.95rem] cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 border-none ${
              activeView === 'list'
                ? 'bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-[var(--color-btn-on-accent)] font-medium shadow-[0_2px_8px_var(--color-app-accent-shadow)]'
                : 'bg-app-surface text-app-muted hover:bg-app-surface-hover hover:text-app-secondary'
            } [&_svg]:text-lg`}
            onClick={() => setActiveView('list')}
          >
            <FiList />
            <span>List</span>
          </button>
          <button
            type="button"
            className={`flex-1 rounded-xl py-3.5 px-4 text-[0.95rem] cursor-pointer flex items-center justify-center gap-2 transition-all duration-200 border-none ${
              activeView === 'calendar'
                ? 'bg-gradient-to-br from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] text-[var(--color-btn-on-accent)] font-medium shadow-[0_2px_8px_var(--color-app-accent-shadow)]'
                : 'bg-app-surface text-app-muted hover:bg-app-surface-hover hover:text-app-secondary'
            } [&_svg]:text-lg`}
            onClick={() => setActiveView('calendar')}
          >
            <FiCalendar />
            <span>Calendar</span>
          </button>
        </div>
      )}

      {/* Income List / Calendar */}
      <div className="mb-8">
        {noData ? (
          <NoData
            icon={<FiDollarSign />}
            title={t('income.noIncome')}
            description={t('income.noIncomeDesc')}
          />
        ) : activeView === 'list' ? (
          filteredIncomeData && filteredIncomeData.length ? (
            <>
              <IncomeTable
                items={filteredIncomeData.slice(0, nrOfItemsToShow)}
                handleEdit={handleEdit}
                setShowDeleteModal={setShowDeleteModal}
                changedItems={data.changedItems}
                handleClearChangedItem={handleClearChangedItem}
                pendingSyncIds={pendingSyncIds}
              />
              {filteredIncomeData.length > nrOfItemsToShow && (
                <div className="flex justify-center items-center py-4 mt-2">
                  <button
                    type="button"
                    onClick={() => setNrOfItemsToShow(nrOfItemsToShow + 10)}
                    className="inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-[var(--color-app-accent)]/20 border border-[var(--color-app-accent)]/40 text-[var(--color-app-accent)] text-[0.95rem] font-semibold cursor-pointer transition-all duration-200 hover:bg-[var(--color-app-accent)]/30 hover:border-[var(--color-app-accent)]/50 hover:-translate-y-0.5 active:translate-y-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&_svg]:text-sm"
                  >
                    <FiChevronDown />
                    <span>
                      {t('common.loadMore')} ({filteredIncomeData.length - nrOfItemsToShow}{' '}
                      {t('common.remaining')})
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <NoData
              icon={<FiDollarSign />}
              title={t('income.noIncome')}
              description={t('income.noIncomeDesc')}
            />
          )
        ) : incomeMonths.length > 0 ? (
          <CalendarView
            variant="income"
            transactions={currentMonthIncome.map((item) => ({
              id: item.id,
              dsc: item.dsc ?? '',
              sum: item.sum,
              cat: item.cat ?? '',
              dt: item.dt,
            }))}
            currentMonth={currentMonth}
            changedItems={data.changedItems}
            onClearChangedItem={handleClearChangedItem}
            pendingSyncIds={pendingSyncIds}
            onMonthChange={(direction) => {
              if (
                direction === 'prev' &&
                currentMonthIndex < incomeMonths.length - 1
              ) {
                setCurrentMonthIndex(currentMonthIndex + 1);
              } else if (direction === 'next' && currentMonthIndex > 0) {
                setCurrentMonthIndex(currentMonthIndex - 1);
              }
            }}
            onEdit={handleEdit}
            onDelete={(id) => setShowDeleteModal(id)}
          />
        ) : (
          <NoData
            icon={<FiDollarSign />}
            title={t('income.noIncome')}
            description={t('income.noIncomeDesc')}
          />
        )}
      </div>

      {/* Month navigation — calendar only */}
      {activeView === 'calendar' &&
        !noData &&
        !filterPanelOpen &&
        incomeMonths.length > 0 && (
          <div className="fixed bottom-[70px] left-1/2 -translate-x-1/2 hidden md:flex justify-center gap-4 z-[100] bg-[var(--color-app-bg)] backdrop-blur-md py-3 px-5 rounded-[20px] shadow-lg max-[360px]:bottom-[60px] max-[360px]:py-2.5">
            <button
              type="button"
              className="w-[50px] h-[50px] flex items-center justify-center rounded-xl border border-app-subtle bg-app-surface-hover cursor-pointer transition-all duration-200 shadow-md [&_svg]:text-app-secondary [&_svg]:text-[1.3rem] hover:not(:disabled):bg-app-surface-hover hover:not(:disabled):border-[var(--color-app-accent)]/40 hover:not(:disabled):scale-105 disabled:opacity-30 disabled:cursor-not-allowed max-[360px]:w-[46px] max-[360px]:h-[46px]"
              onClick={() => setCurrentMonthIndex(currentMonthIndex + 1)}
              disabled={currentMonthIndex >= incomeMonths.length - 1}
              aria-label="Previous month"
            >
              <FiChevronLeft />
            </button>
            <button
              type="button"
              className="w-[50px] h-[50px] flex items-center justify-center rounded-xl border border-app-subtle bg-app-surface-hover cursor-pointer transition-all duration-200 shadow-md [&_svg]:text-app-secondary [&_svg]:text-[1.3rem] hover:not(:disabled):bg-app-surface-hover hover:not(:disabled):border-[var(--color-app-accent)]/40 hover:not(:disabled):scale-105 disabled:opacity-30 disabled:cursor-not-allowed max-[360px]:w-[46px] max-[360px]:h-[46px]"
              onClick={() => setCurrentMonthIndex(currentMonthIndex - 1)}
              disabled={currentMonthIndex <= 0}
              aria-label="Next month"
            >
              <FiChevronRight />
            </button>
          </div>
        )}

      {/* Charts Section */}
      {data.incomeData?.length ? (
        <>
          <div className="mb-8">
            <YearIncomeAverageTrend
              filteredIncomeData={filteredIncomeData}
              isFiltered={
                !!(
                  filters.textFilter ||
                  filters.selectedTag ||
                  (filters.dateRange?.start && filters.dateRange?.end)
                )
              }
            />
          </div>
          <div className="mb-8">
            <IncomeExpensesPerYearBarChart
              filteredIncomeData={filteredIncomeData}
              dateRange={filters.dateRange}
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
            className={BTN_SUBMIT_CLASS}
          >
            {incomeFormSubmitting ? (
              <Loader variant="on-button" />
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
          className={FAB_CLASS}
          title={t('incomeForm.addIncome')}
        >
          <FiPlus />
        </button>
      )}
    </div>
  );
};

export default Income;
