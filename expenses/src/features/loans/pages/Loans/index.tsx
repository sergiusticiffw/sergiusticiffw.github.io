import { useEffect, useState, useMemo, FC } from 'react';
import { useAuthDispatch, useAuthState } from '@shared/context/context';
import { useLoan } from '@shared/context/loan';
import { useLocalization } from '@shared/context/localization';
import {
  deleteLoan,
  formatNumber,
  getLoanStatus,
} from '@shared/utils/utils';
import { fetchLoans as fetchLoansService } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useNotification } from '@shared/context/notification';
import { notificationType } from '@shared/utils/constants';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import {
  buildLoanDataFromApiLoan,
  buildEventsFromApiPayments,
  calculateAmortization,
} from '@features/loans/utils/amortization';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import {
  PageHeader,
  LoadingSpinner,
  DeleteConfirmDrawer,
  NoData,
} from '@shared/components/Common';
import { FiCreditCard, FiPlus } from 'react-icons/fi';
import VaulDrawer from '@shared/components/VaulDrawer';
import LoanForm from '@features/loans/components/Loan/LoanForm';
import LoansList from '@features/loans/components/Loan/LoansList';

const Loans: FC = () => {
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState();
  const { t } = useLocalization();
  const dispatch = useAuthDispatch();
  const apiClient = useApiClient();
  const showNotification = useNotification();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [focusedItem, setFocusedItem] = useState<Partial<ApiLoan> & { nid?: string; [key: string]: unknown }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loanFormSubmitting, setLoanFormSubmitting] = useState(false);
  const [loanFormEditSubmitting, setLoanFormEditSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { loans, loading, payments } = data;

  // Event-driven pending sync tracking (no polling) - for loans and payments
  const pendingLoanIds = usePendingSyncIds(['loan']);
  const pendingPaymentIds = usePendingSyncIds(['payment']);

  useEffect(() => {
    if (!loans && apiClient) {
      fetchLoansService(apiClient, dataDispatch);
    }
  }, [loans, apiClient, dataDispatch]);

  const handleEdit = (id: string) => {
    const item = loans?.find((loan: ApiLoan) => loan.id === id);
    if (!item) return;
    setFocusedItem({
      nid: item.id,
      title: item.title,
      field_principal: item.fp,
      field_start_date: item.sdt,
      field_end_date: item.edt,
      field_rate: item.fr,
      field_initial_fee: item.fif,
      field_rec_first_payment_date: item.pdt,
      field_recurring_payment_day: item.frpd,
      field_loan_status: item.fls,
    });
    setShowEditModal(true);
  };

  const handleDelete = (id: string) => {
    const item = loans?.find((loan: ApiLoan) => loan.id === id);
    setFocusedItem(item ?? {});
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    setIsSubmitting(true);
    const id = 'id' in focusedItem ? focusedItem.id : '';
    deleteLoan(id, token, dataDispatch, dispatch, () => {
      setIsSubmitting(false);
      setShowDeleteModal(false);
      showNotification(t('notification.loanDeleted'), notificationType.SUCCESS);
      // UI update is handled by deleteLoan, only fetch if online
      if (navigator.onLine) {
        if (apiClient) {
          fetchLoansService(apiClient, dataDispatch);
        }
      }
    });
  };

  const getLoanStatusForLoan = (loan: ApiLoan) => getLoanStatus(loan?.fls);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return t('common.completed');
      case 'active':
        return t('common.active');
      case 'pending':
        return t('common.pending');
      default:
        return t('common.status');
    }
  };

  const amortizationByLoanId = useMemo(() => {
    const map = new Map<
      string,
      { paydown: { sum_of_installments: number }; totalPaidAmount: number }
    >();
    if (!loans?.length || !payments?.length) return map;
    const paymentsList = payments as LoanPaymentsEntry[];
    for (const loan of loans as ApiLoan[]) {
      const status = getLoanStatus(loan?.fls);
      if (status === 'completed') {
        map.set(loan.id, { paydown: { sum_of_installments: 1 }, totalPaidAmount: 1 });
        continue;
      }
      if (status === 'pending') {
        map.set(loan.id, { paydown: { sum_of_installments: 0 }, totalPaidAmount: 0 });
        continue;
      }
      const filteredData = paymentsList.find(
        (item) => item?.loanId === loan.id && item?.data?.length > 0
      );
      if (!filteredData?.data?.length) {
        map.set(loan.id, { paydown: { sum_of_installments: 0 }, totalPaidAmount: 0 });
        continue;
      }
      const loanData = buildLoanDataFromApiLoan(loan);
      if (!loanData) {
        map.set(loan.id, { paydown: { sum_of_installments: 0 }, totalPaidAmount: 0 });
        continue;
      }
      const events = buildEventsFromApiPayments(
        filteredData.data as ApiPaymentItem[]
      );
      try {
        const { paydown } = calculateAmortization(loanData, events);
        const totalPaidAmount = filteredData.data.reduce(
          (sum: number, item: ApiPaymentItem) =>
            sum + parseFloat(String(item.fpi ?? '0')),
          0
        );
        const sumInstallments = paydown.sum_of_installments || 0;
        map.set(loan.id, { paydown, totalPaidAmount });
      } catch {
        map.set(loan.id, { paydown: { sum_of_installments: 0 }, totalPaidAmount: 0 });
      }
    }
    return map;
  }, [loans, payments]);

  const calculateLoanProgress = (loan: ApiLoan) => {
    const status = getLoanStatusForLoan(loan);
    if (status === 'completed') return 100;
    if (status === 'pending') return 0;
    const entry = amortizationByLoanId.get(loan.id);
    if (!entry) return 0;
    const { paydown, totalPaidAmount } = entry;
    const sumInstallments = paydown.sum_of_installments || 0;
    if (sumInstallments === 0) return 0;
    return Math.max(0, Math.min(100, (totalPaidAmount / sumInstallments) * 100));
  };

  // Filter loans
  const filteredLoans = useMemo(() => {
    if (!loans) return [];

    let filtered = loans;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = loans.filter(
        (loan: ApiLoan) => getLoanStatusForLoan(loan) === statusFilter
      );
    }

    return filtered;
  }, [loans, statusFilter]);

  // Calculate stats based on filtered loans
  const totalLoans = filteredLoans?.length || 0;
  const activeLoans =
    filteredLoans?.filter(
      (loan: ApiLoan) => getLoanStatusForLoan(loan) === 'active'
    ).length || 0;
  const completedLoans =
    filteredLoans?.filter(
      (loan: ApiLoan) => getLoanStatusForLoan(loan) === 'completed'
    ).length || 0;

  if (loading) {
    return (
      <div className="page-container">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="page-container px-4 md:px-6">
      {/* Header */}
      <PageHeader
        title={t('loans.title')}
        subtitle={`${totalLoans} ${totalLoans === 1 ? t('loans.loan') : t('loans.loans')}`}
      />

      {/* Simple Stats (hidden, can be enabled later) */}
      <div className="hidden">
        <div className="stat-item">
          <span className="stat-value">{formatNumber(totalLoans)}</span>
          <span className="stat-label">{t('common.total')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(activeLoans)}</span>
          <span className="stat-label">{t('loans.active')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(completedLoans)}</span>
          <span className="stat-label">{t('common.completed')}</span>
        </div>
      </div>

      {/* Loans List Section */}
      <div className="mb-8">
        {filteredLoans.length === 0 ? (
          <NoData
            icon={<FiCreditCard />}
            title={t('loans.noLoans')}
            description={
              statusFilter !== 'all'
                ? `${t('loans.noLoansWithStatus')} "${getStatusText(statusFilter)}".`
                : t('loans.noLoansDesc')
            }
            action={
              statusFilter !== 'all'
                ? {
                    label: t('loans.showAllLoans'),
                    onClick: () => setStatusFilter('all'),
                  }
                : undefined
            }
          />
        ) : (
          <LoansList
            loans={loans || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getStatus={getLoanStatusForLoan}
            getStatusText={getStatusText}
            getProgress={calculateLoanProgress}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            pendingSyncIds={pendingLoanIds}
          />
        )}
      </div>

      {/* Add Loan Drawer */}
      <VaulDrawer
        show={showAddModal}
        onClose={(e) => {
          e.preventDefault();
          setShowAddModal(false);
        }}
        title={t('loan.addLoan')}
        footer={
          <button
            type="submit"
            form="loan-form-add"
            disabled={loanFormSubmitting}
            className="btn-submit"
          >
            {loanFormSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : (
              t('common.add')
            )}
          </button>
        }
      >
        <LoanForm
          formType="add"
          values={{
            nid: '',
            title: '',
            field_principal: 0,
            field_start_date: '',
            field_end_date: '',
            field_rate: 0,
            field_initial_fee: 0,
            field_rec_first_payment_date: '',
            field_recurring_payment_day: 0,
          }}
          hideSubmitButton={true}
          onFormReady={(submitHandler, isSubmitting) => {
            setLoanFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowAddModal(false);
            // UI update is handled by useFormSubmit, only fetch if online
            if (navigator.onLine && apiClient) {
              fetchLoansService(apiClient, dataDispatch);
            }
          }}
        />
      </VaulDrawer>

      {/* Edit Loan Drawer */}
      <VaulDrawer
        show={showEditModal}
        onClose={(e) => {
          e.preventDefault();
          setShowEditModal(false);
        }}
        title={t('loan.editLoan')}
        footer={
          <button
            type="submit"
            form="loan-form-edit"
            disabled={loanFormEditSubmitting}
            className="btn-submit"
          >
            {loanFormEditSubmitting ? (
              <div className="loader">
                <span className="loader__element"></span>
                <span className="loader__element"></span>
                <span className="loader__element"></span>
              </div>
            ) : (
              t('common.save')
            )}
          </button>
        }
      >
        <LoanForm
          formType="edit"
          values={focusedItem}
          hideSubmitButton={true}
          onFormReady={(submitHandler, isSubmitting) => {
            setLoanFormEditSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            // UI update is handled by useFormSubmit, only fetch if online
            if (navigator.onLine && apiClient) {
              fetchLoansService(apiClient, dataDispatch);
            }
          }}
        />
      </VaulDrawer>

      {/* Delete Confirmation Drawer */}
      <DeleteConfirmDrawer
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDelete}
        title={t('loan.deleteLoan')}
        message={t('modal.deleteLoanMessage')}
        isSubmitting={isSubmitting}
      />

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fab"
        title={t('loans.addLoan')}
      >
        <FiPlus />
      </button>
    </div>
  );
};

export default Loans;
