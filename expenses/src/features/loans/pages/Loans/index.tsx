import { useEffect, useState, useMemo, FC, useRef } from 'react';
import { useAuthDispatch, useAuthState } from '@shared/context/context';
import { useLoan } from '@shared/context/loan';
import { useLocalization } from '@shared/context/localization';
import { deleteLoan, getLoanStatus } from '@shared/utils/utils';
import { fetchLoans as fetchLoansService } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useNotification } from '@shared/context/notification';
import { notificationType } from '@shared/utils/constants';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import {
  buildLoanDataFromApiLoan,
  buildEventsFromApiPayments,
  calculatePaydownOnly,
} from '@features/loans/utils/amortization';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import { Card } from '@shared/ui';
import {
  Loader,
  LoadingSpinner,
  DeleteConfirmDrawer,
  NoData,
} from '@shared/components/Common';
import { PAGE_CONTAINER_CLASS, BTN_SUBMIT_CLASS, FAB_CLASS } from '@shared/utils/layoutClasses';
import { FiCreditCard, FiPlus, FiEdit2 } from 'react-icons/fi';
import VaulDrawer from '@shared/components/VaulDrawer';
import LoanForm from '@features/loans/components/Loan/LoanForm';
import LoansList, {
  type LoanAmounts,
} from '@features/loans/components/Loan/LoansList';

const LOAN_STATUS_COLORS = {
  active: 'var(--color-app-accent)',
  completed: '#22c55e',
  pending: '#94a3b8',
} as const;

type PaydownTotals = {
  sum_of_installments?: number;
  remaining_principal?: number;
  unpaid_interest?: number;
  sum_of_fees?: number;
};

type LoanAmortizationEntry = {
  paydown: PaydownTotals;
  totalPaidAmount: number;
  installmentsPaidAmount?: number;
};

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
  const { loans, loading, payments } = data;

  // Event-driven pending sync tracking (no polling) - for loans and payments
  const pendingLoanIds = usePendingSyncIds(['loan']);
  // Payments pending IDs are not used on this page; avoid extra listeners/work.

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
      field_payment_method: item.fpm || 'equal_installment',
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
    const id = 'id' in focusedItem ? String(focusedItem.id ?? '') : '';
    deleteLoan(id, token, dataDispatch, dispatch, () => {
      setIsSubmitting(false);
      setShowDeleteModal(false);
      showNotification(t('notification.loanDeleted'), notificationType.SUCCESS);
      // UI update is handled by deleteLoan (offline-first + sync queue).
      // Avoid immediate refetch here: it can briefly reintroduce deleted items
      // if the server snapshot still contains them (eventual consistency / sync delay).
    });
  };

  const getLoanStatusForLoan = (loan: ApiLoan) => getLoanStatus(loan?.fls);

  const paydownCacheRef = useRef(new Map<string, LoanAmortizationEntry>());

  const hashString = (input: string): string => {
    // djb2
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
      h = (h * 33) ^ input.charCodeAt(i);
    }
    return (h >>> 0).toString(16);
  };

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
    const map = new Map<string, LoanAmortizationEntry>();
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

      const paymentItems = filteredData.data as ApiPaymentItem[];
      const events = buildEventsFromApiPayments(paymentItems);
      // Same rule as the loan detail page: real (non-simulated) payments, installment + single fee.
      let installmentsPaidAmount = 0;
      let singleFeesPaidAmount = 0;
      for (const item of paymentItems) {
        if (Number(item.fisp ?? 0) !== 0) continue;
        installmentsPaidAmount += parseFloat(String(item.fpi ?? '0')) || 0;
        singleFeesPaidAmount += parseFloat(String(item.fpsf ?? '0')) || 0;
      }
      const totalPaidAmount = installmentsPaidAmount + singleFeesPaidAmount;

      const loanKey = hashString(
        [
          loan.id,
          loan.sdt,
          loan.edt,
          loan.fp,
          loan.fr,
          loan.fif,
          loan.pdt,
          loan.frpd,
          loan.fpm,
          loan.fls,
        ]
          .map((v) => String(v ?? ''))
          .join('|')
      );

      const paymentsKey = hashString(
        paymentItems
          .map(
            (p) =>
              `${p.id}|${p.cr ?? ''}|${p.fdt ?? ''}|${p.fpi ?? ''}|${p.fpsf ?? ''}|${p.fr ?? ''}|${p.fnp ?? ''}|${p.fpm ?? ''}|${p.fisp ?? ''}`
          )
          .join('~')
      );

      const cacheKey = `${loanKey}:${paymentsKey}`;
      const cached = paydownCacheRef.current.get(cacheKey);
      if (cached) {
        map.set(loan.id, cached);
        continue;
      }

      try {
        const result = calculatePaydownOnly(loanData, events);
        const entry: LoanAmortizationEntry = {
          paydown: {
            sum_of_installments: result.sum_of_installments ?? 0,
            remaining_principal: result.remaining_principal ?? 0,
            unpaid_interest: result.unpaid_interest ?? 0,
            sum_of_fees: result.sum_of_fees ?? 0,
          },
          totalPaidAmount,
          installmentsPaidAmount,
        };
        map.set(loan.id, entry);
        paydownCacheRef.current.set(cacheKey, entry);
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
    const { paydown, installmentsPaidAmount = 0 } = entry;
    // Progress excludes fees (both paid single fees and expected fees).
    const totalInstallments =
      (paydown.sum_of_installments ?? 0) +
      (paydown.remaining_principal ?? 0) +
      (paydown.unpaid_interest ?? 0);
    if (totalInstallments <= 0) return 0;
    return Math.max(
      0,
      Math.min(100, (installmentsPaidAmount / totalInstallments) * 100)
    );
  };

  const getLoanAmounts = (loan: ApiLoan): LoanAmounts => {
    const status = getLoanStatusForLoan(loan);
    const principal = parseFloat(String(loan.fp ?? '0')) || 0;
    if (status === 'completed') {
      return { paid: null, remaining: 0, total: null };
    }
    const entry =
      status === 'active' ? amortizationByLoanId.get(loan.id) : undefined;
    const { paydown, totalPaidAmount } = entry ?? {
      paydown: {},
      totalPaidAmount: 0,
    };
    const total =
      (paydown.sum_of_installments ?? 0) +
      (paydown.remaining_principal ?? 0) +
      (paydown.unpaid_interest ?? 0) +
      (paydown.sum_of_fees ?? 0);
    if (total === 0 || totalPaidAmount === 0) {
      return { paid: 0, remaining: principal, total: principal };
    }
    return {
      paid: totalPaidAmount,
      remaining: Math.max(0, total - totalPaidAmount),
      total,
    };
  };

  const totalLoans = loans?.length ?? 0;
  const statusCounts = useMemo(() => {
    const counts = { active: 0, pending: 0, completed: 0 };
    for (const loan of (loans ?? []) as ApiLoan[]) {
      counts[getLoanStatusForLoan(loan)]++;
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans]);

  const deleteItem = useMemo(() => {
    if (!showDeleteModal || !('id' in focusedItem)) return null;
    const loan = focusedItem as ApiLoan;
    const status = getLoanStatusForLoan(loan);
    const statusColor =
      LOAN_STATUS_COLORS[status as keyof typeof LOAN_STATUS_COLORS] ??
      LOAN_STATUS_COLORS.pending;
    return {
      variant: 'loan' as const,
      dt: loan.sdt ?? '',
      dsc: loan.title ?? '',
      sum: loan.fp ?? 0,
      badge: (
        <span
          className="py-0.5 px-2.5 rounded-full text-[0.7rem] font-bold uppercase tracking-wide whitespace-nowrap border bg-transparent"
          style={{
            color: statusColor,
            borderColor: `color-mix(in srgb, ${statusColor} 55%, transparent)`,
          }}
        >
          {getStatusText(status)}
        </span>
      ),
    };
  }, [showDeleteModal, focusedItem, t]);

  if (loading) {
    return (
      <div className={PAGE_CONTAINER_CLASS}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={PAGE_CONTAINER_CLASS}>
      <div className="pt-6">
        <Card
          variant="surface"
          padding="lg"
          className="mb-5 flex flex-col gap-4 border-[var(--color-border-subtle)] shadow-[0_8px_28px_rgba(0,0,0,0.24)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 text-2xl font-extrabold tracking-tight text-app-primary leading-tight">
              {t('loans.title')}
            </h2>
            <span className="shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs bg-[var(--color-surface-2)]/60 text-app-muted/80 tabular-nums">
              {totalLoans} {totalLoans === 1 ? t('loans.loan') : t('loans.loans')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['active', 'pending', 'completed'] as const).map((status) => (
              <div
                key={status}
                className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
              >
                <div
                  className="text-2xl font-bold tabular-nums leading-tight"
                  style={{ color: LOAN_STATUS_COLORS[status] }}
                >
                  {statusCounts[status]}
                </div>
                <div className="text-micro uppercase tracking-wider text-app-muted truncate">
                  {getStatusText(status)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Loans List Section */}
      <div className="mb-8">
        {!loans?.length ? (
          <NoData
            icon={<FiCreditCard />}
            title={t('loans.noLoans')}
            description={t('loans.noLoansDesc')}
          />
        ) : (
          <LoansList
            loans={loans || []}
            onEdit={handleEdit}
            onDelete={handleDelete}
            getStatus={getLoanStatusForLoan}
            getStatusText={getStatusText}
            getProgress={calculateLoanProgress}
            getAmounts={getLoanAmounts}
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
            className={BTN_SUBMIT_CLASS}
          >
            {loanFormSubmitting ? (
              <Loader variant="on-button" />
            ) : (
              <>
                <FiPlus />
                <span>{t('loan.addLoan')}</span>
              </>
            )}
          </button>
        }
      >
        <LoanForm
          formType="add"
          values={{
            nid: '',
            title: '',
            field_principal: '',
            field_start_date: '',
            field_end_date: '',
            field_rate: '',
            field_payment_method: 'equal_installment',
            field_initial_fee: '',
            field_rec_first_payment_date: '',
            field_recurring_payment_day: '',
          }}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, isSubmitting) => {
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
            className={BTN_SUBMIT_CLASS}
          >
            {loanFormEditSubmitting ? (
              <Loader variant="on-button" />
            ) : (
              <>
                <FiEdit2 />
                <span>{t('loan.editLoan')}</span>
              </>
            )}
          </button>
        }
      >
        <LoanForm
          formType="edit"
          values={focusedItem}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, isSubmitting) => {
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
        item={deleteItem}
      />

      {/* FAB – same pattern as transaction (Add Transaction) */}
      <button
        onClick={() => setShowAddModal(true)}
        className={FAB_CLASS}
        title={t('loan.addLoan')}
      >
        <FiPlus />
      </button>
    </div>
  );
};

export default Loans;
