import React, { useEffect, useMemo, useState } from 'react';
import LoanDetails from '@features/loans/components/Loan/LoanDetails';
import LoanDashboard from '@features/loans/components/Loan/dashboard/LoanDashboard';
import LoanForm from '@features/loans/components/Loan/LoanForm';
import VaulDrawer from '@shared/components/VaulDrawer';
import { useParams } from '@tanstack/react-router';
import PaymentDetails from '@features/loans/components/Loan/PaymentDetails';
import PaymentForm from '@features/loans/components/Loan/PaymentForm';
import { Loader, LoadingSpinner } from '@shared/components/Common';
import { BTN_SUBMIT_CLASS, FAB_CLASS } from '@shared/utils/layoutClasses';
import { useLoan } from '@shared/context/loan';
import {
  calculateDaysFrom,
  formatNumber,
  transformDateFormat,
  transformToNumber,
  getLoanStatus,
} from '@shared/utils/utils';
import { fetchLoans as fetchLoansService } from '@features/loans/api/loans';
import { useApiClient } from '@shared/hooks/useApiClient';
import { useAmortization } from '@features/loans/hooks/useAmortization';
import {
  getNextRegularPayment,
  scheduleDateToFormDate,
  calculateInterestSavings,
} from '@features/loans/utils/amortization';
import { getEffectiveRateFromSchedule } from '@features/loans/utils/loanSnapshot';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import {
  FiDollarSign,
  FiEdit2,
  FiPlus,
  FiCheckCircle,
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiPercent,
  FiTrendingDown,
  FiAlertCircle,
} from 'react-icons/fi';
import Notification from '@shared/components/Notification/Notification';
import { useLocalization } from '@shared/context/localization';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import { useChartsThemeSync } from '@shared/context/highcharts';
import { PAGE_CONTAINER_CLASS } from '@shared/utils/layoutClasses';

const Loan: React.FC = () => {
  useChartsThemeSync();
  const { id } = useParams({ from: '/expenses/loan/$id' });
  const { data, dataDispatch } = useLoan();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [prefillNextPayment, setPrefillNextPayment] = useState(false);
  const [loanFormEditSubmitting, setLoanFormEditSubmitting] = useState(false);
  const [paymentFormSubmitting, setPaymentFormSubmitting] = useState(false);
  const [customExtra, setCustomExtra] = useState(0);
  const { loans } = data;
  const noData = data.loans === null;
  const { t } = useLocalization();
  const apiClient = useApiClient();

  // Event-driven pending sync tracking (no polling) - for payments
  const pendingPaymentIds = usePendingSyncIds(['payment']);

  useEffect(() => {
    if (noData && apiClient) {
      fetchLoansService(apiClient, dataDispatch);
    }
  }, [noData, apiClient, dataDispatch]);

  const loan = loans?.find((l) => l.id === id) as ApiLoan | undefined;
  const filteredData = (data?.payments as LoanPaymentsEntry[] | undefined)?.find(
    (item) => item?.loanId === id && item?.data?.length > 0
  );
  const paymentsForLoan = useMemo(
    () => (filteredData?.data ?? []) as ApiPaymentItem[],
    [filteredData?.data]
  );
  const amort = useAmortization(loan ?? null, paymentsForLoan);
  const interestSavings = useMemo(
    () => calculateInterestSavings(loan, paymentsForLoan),
    [loan, paymentsForLoan]
  );
  const nextRegularPayment = useMemo(
    () => getNextRegularPayment(amort.schedule),
    [amort.schedule]
  );
  const emptyPaymentValues = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      nid: '',
      title: '',
      field_date: today,
      field_rate: '',
      field_pay_installment: '',
      field_pay_single_fee: '',
      field_new_recurring_amount: '',
      field_new_principal: '',
      field_payment_method: '',
    };
  }, []);

  const prefilledPaymentValues = useMemo(() => {
    if (!nextRegularPayment) return emptyPaymentValues;
    return {
      nid: '',
      title: nextRegularPayment.title,
      field_date: scheduleDateToFormDate(nextRegularPayment.date),
      field_rate: '',
      field_pay_installment: nextRegularPayment.installment,
      field_pay_single_fee: '',
      field_new_recurring_amount: '',
      field_new_principal: '',
      field_payment_method: '',
    };
  }, [nextRegularPayment, emptyPaymentValues]);

  const addPaymentValues = prefillNextPayment
    ? prefilledPaymentValues
    : emptyPaymentValues;

  const openAddPayment = (prefill: boolean) => {
    setPrefillNextPayment(prefill);
    setShowAddPaymentModal(true);
  };

  const closeAddPayment = () => {
    setShowAddPaymentModal(false);
    setPrefillNextPayment(false);
  };

  if (!loan) {
    return (
      <div className={PAGE_CONTAINER_CLASS}>
        <LoadingSpinner />
      </div>
    );
  }

  const loanStatus = getLoanStatus(String(loan?.fls ?? ''));
  const paydown = amort.paydown;
  const amortizationSchedule = amort.schedule;
  const errorMessage = amort.error;
  const loanData = {
    start_date: transformDateFormat(loan.sdt ?? ''),
    end_date: transformDateFormat(loan.edt ?? ''),
    principal: transformToNumber(loan.fp ?? 0),
    rate: transformToNumber(loan.fr ?? 0),
  };

  // Sum ONLY actual (non-simulated) payments; include installment + any single-fee payments.
  // This keeps Paid/Remaining/Progress consistent with Principal Paid / Interest Paid (which are based on actual payments).
  const totalPaidAmount =
    filteredData?.data
      ?.filter((item) => Number(item.fisp ?? 0) === 0)
      .reduce((sum: number, item: ApiPaymentItem) => {
        const installment = parseFloat(String(item.fpi ?? '0')) || 0;
        const singleFee = parseFloat(String(item.fpsf ?? '0')) || 0;
        return sum + installment + singleFee;
      }, 0) ?? 0;

  // Use effective_principal from paydown (new_principal if refinanced, else init)
  const totalPrincipal =
    (paydown?.effective_principal ?? parseFloat(String(loan.fp ?? '0'))) ||
    parseFloat(String(loan.fp ?? '0'));
  const totalInstallments =
    (paydown?.sum_of_installments ?? 0) +
    (paydown?.remaining_principal ?? 0) +
    (paydown?.unpaid_interest ?? 0) +
    (paydown?.sum_of_fees ?? 0);

  const calculateProgress = () => {
    if (loanStatus === 'completed') return 100;
    if (loanStatus === 'pending') return 0;
    if (!loan.fp || !paydown) return 0;

    if (totalInstallments === 0) return 0;

    const progressValue = ((totalPaidAmount ?? 0) / totalInstallments) * 100;

    return Math.max(0, Math.min(progressValue, 100));
  };

  const progress = calculateProgress();
  const remainingAmount = totalInstallments - (totalPaidAmount ?? 0);
  const remainingDisplay =
    loanStatus === 'completed' || loanStatus === 'pending'
      ? loanStatus === 'completed'
        ? t('common.completed')
        : t('loan.notStarted')
      : formatNumber(remainingAmount);
  const daysCalculated = paydown?.days_calculated || 0;

  // Calculate days passed and remaining
  const startDateParts = loanData.start_date?.split('.') || [];
  const [day, month, year] =
    startDateParts.length >= 3 ? startDateParts : ['01', '01', '2024'];
  const formattedStartDate = `${year}-${month}-${day}`;
  const daysSince = calculateDaysFrom(formattedStartDate);
  const daysPassed = daysSince > 0 ? Math.min(daysSince, daysCalculated) : 0;
  const daysRemaining = Math.max(daysCalculated - daysPassed, 0);

  // Calculate time-based metrics for progress section
  const monthsPassed = Math.floor(daysPassed / 30);
  const totalMonths = Math.ceil(daysCalculated / 30);

  const monthsPassedDisplay =
    loanStatus === 'active'
      ? `${monthsPassed} / ${totalMonths}`
      : loanStatus === 'completed'
        ? `${totalMonths} / ${totalMonths}`
        : t('loan.notStarted');

  const daysRemainingDisplay =
    loanStatus === 'active'
      ? daysRemaining
      : loanStatus === 'completed'
        ? t('common.completed')
        : t('loan.notStarted');

  // Get total interest paid from paydown calculation
  const interestPaid =
    loanStatus === 'pending' || !paydown ? 0 : paydown.interest_paid || 0;
  const interestPaidDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : formatNumber(interestPaid);

  // Fees paid from actual (non-simulated) payments only
  const feesPaidActual =
    filteredData?.data
      ?.filter((item) => Number(item.fisp ?? 0) === 0)
      .reduce((sum: number, item: ApiPaymentItem) => {
        const singleFee = parseFloat(String(item.fpsf ?? '0')) || 0;
        return sum + singleFee;
      }, 0) ?? 0;

  const interestSavingsValue =
    loanStatus === 'pending' || !paydown ? 0 : interestSavings;
  const interestSavingsDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : interestSavingsValue > 0
        ? formatNumber(interestSavingsValue)
        : formatNumber(0);

  // Principal paid from actual payments only (not simulated future)
  const principalPaid =
    loanStatus === 'pending' || !paydown
      ? 0
      : Math.max(0, (totalPaidAmount ?? 0) - (interestPaid ?? 0) - feesPaidActual);
  const principalPaidDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : formatNumber(principalPaid);

  // Remaining principal after last actual payment (not simulated future)
  const remainingPrincipal =
    loanStatus === 'pending' || !paydown
      ? 0
      : paydown.remaining_principal_after_paid ?? paydown.remaining_principal ?? 0;
  const remainingPrincipalDisplay =
    loanStatus === 'pending' || loanStatus === 'completed'
      ? loanStatus === 'completed'
        ? t('common.completed')
        : t('loan.notStarted')
      : formatNumber(remainingPrincipal);

  const currentRate =
    loanStatus === 'pending' || !paydown
      ? loanData.rate || 0
      : getEffectiveRateFromSchedule(amortizationSchedule) ??
          (loanData.rate || 0);

  // Current daily interest (approx): remaining principal * APR / 365
  // Uses latest effective rate from the amortization schedule to reflect rate changes.
  const dailyInterest =
    loanStatus === 'pending' || !paydown
      ? 0
      : Math.max(0, remainingPrincipal * ((currentRate || 0) / 100) / 365);
  const dailyInterestDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : loanStatus === 'completed'
        ? t('common.completed')
        : formatNumber(dailyInterest);

  const iconTw = 'w-4 h-4 shrink-0 text-[var(--color-app-accent)]';

  return (
    <div className={`${PAGE_CONTAINER_CLASS} loan-container`}>
      {/* Header */}
      <div className="w-full text-center mb-5 pt-6 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-white tracking-tight m-0">{loan?.title}</h1>
        <button
          type="button"
          onClick={() => setShowEditModal(true)}
          className="w-full inline-flex items-center justify-center gap-2 mt-4 py-3 px-6 min-h-12 text-base font-semibold text-white bg-white/10 border border-white/10 rounded-xl hover:bg-white/15 hover:border-[var(--color-app-accent)] active:scale-[0.98] transition-all cursor-pointer"
        >
          <FiEdit2 className="w-5 h-5 shrink-0 text-[var(--color-app-accent)]" />
          <span>{t('loan.editLoan')}</span>
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6">
          <Notification message={errorMessage} type="error" />
        </div>
      )}

      {/* HERO: Payment progress */}
      <div className="bg-gradient-to-br from-white/[0.07] to-white/[0.03] border border-white/10 rounded-2xl p-6 pb-5 mb-5 shadow-lg">
        <h2 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 m-0">
          {t('loan.paymentProgress')}
        </h2>
        <div className="mb-3">
          <span className="text-4xl font-extrabold text-white tracking-tight tabular-nums sm:text-3xl">
            {formatNumber(progress)}%
          </span>
        </div>
        <div className="w-full h-3 rounded-md bg-black/20 overflow-hidden shadow-inner">
          <div
            className="h-full rounded-md bg-gradient-to-r from-[var(--color-app-accent)] to-[var(--color-app-accent-hover)] transition-[width] duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-white/5 text-sm text-white/55">
          <span className="inline-flex items-center gap-2">
            <FiCalendar className={iconTw} />
            <span>{t('loan.monthsPassed')}: <strong className="text-white font-semibold">{monthsPassedDisplay}</strong></span>
          </span>
          <span className="inline-flex items-center gap-2">
            <FiClock className={iconTw} />
            <span>{t('loan.daysRemaining')}: <strong className="text-white font-semibold">{daysRemainingDisplay}</strong></span>
          </span>
        </div>
      </div>

      {/* Dashboard: KPIs, simulator, insights, charts */}
      <LoanDashboard
        loan={loan}
        payments={paymentsForLoan}
        paydown={paydown}
        schedule={amortizationSchedule}
        loanStatus={loanStatus}
        progress={progress}
        principalPaid={principalPaid}
        totalPrincipal={totalPrincipal}
        totalPaidAmount={totalPaidAmount}
        remainingDisplay={remainingDisplay}
        customExtra={customExtra}
        onExtraChange={setCustomExtra}
        onAddPayment={() => openAddPayment(true)}
        detailRows={
          <>
            <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiCalendar className={iconTw} />
                {t('loan.startDate')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {loanData.start_date || '-'}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiCalendar className={iconTw} />
                {t('loan.endDate')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {loanData.end_date ||
                  (amortizationSchedule.length > 0
                    ? (() => {
                        const lastRow =
                          amortizationSchedule[amortizationSchedule.length - 1];
                        if (Array.isArray(lastRow)) return lastRow[0] || '-';
                        return lastRow?.date || '-';
                      })()
                    : '-')}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiBarChart2 className={iconTw} />
                {t('common.total')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {formatNumber(totalInstallments)}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiPercent className={iconTw} />
                {t('loan.currentInterest')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {interestPaidDisplay}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiPercent className={iconTw} />
                {t('loan.dailyInterest')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {dailyInterestDisplay}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiTrendingDown className={iconTw} />
                {t('loan.interestSavings')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {interestSavingsDisplay}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 border-b border-white/5">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiCheckCircle className={iconTw} />
                {t('loan.principalPaid')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {principalPaidDisplay}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4">
              <span className="inline-flex items-center gap-2 text-[0.825rem] text-white/55 font-medium">
                <FiAlertCircle className={iconTw} />
                {t('loan.remainingPrincipal')}
              </span>
              <span className="text-sm font-semibold text-white tabular-nums text-right">
                {remainingPrincipalDisplay}
              </span>
            </div>
          </>
        }
      />

      {/* Loan Sections */}
      <div className="flex flex-col gap-8 w-full sm:gap-6">
        {/* Payment Details Section */}
        <div className="w-full">
          <div className="flex items-center justify-center gap-3 mb-4 pb-3 border-b border-white/5">
            <FiDollarSign className="text-xl text-[var(--color-app-accent)]" />
            <h3 className="text-lg font-semibold text-white m-0">{t('loan.paymentHistory')}</h3>
          </div>
          <PaymentDetails
            loan={loan}
            payments={filteredData?.data || []}
            totalPaidAmount={totalPaidAmount}
            pendingSyncIds={pendingPaymentIds}
          />
        </div>

        {/* Loan Details Section (Amortization) */}
        <div className="w-full">
          <div className="flex items-center justify-center gap-3 mb-4 pb-3 border-b border-white/5">
            <FiBarChart2 className="text-xl text-[var(--color-app-accent)]" />
            <h3 className="text-lg font-semibold text-white m-0">
              {t('loan.amortizationSchedule')}
            </h3>
          </div>
          <LoanDetails
            loanData={loanData}
            loan={paydown}
            amortizationSchedule={amortizationSchedule}
            totalPaidAmount={totalPaidAmount}
          />
        </div>
      </div>

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
          formType={'edit'}
          values={{
            nid: loan.id,
            title: loan.title,
            field_principal: loan.fp,
            field_start_date: loan.sdt,
            field_end_date: loan.edt,
            field_rate: loan.fr,
            field_payment_method: loan.fpm || 'equal_installment',
            field_initial_fee: loan.fif,
            field_rec_first_payment_date: loan.pdt,
            field_recurring_payment_day: loan.frpd,
            field_loan_status: loan.fls,
          }}
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

      {/* Add Payment Drawer */}
      <VaulDrawer
        show={showAddPaymentModal}
        onClose={(e) => {
          e.preventDefault();
          closeAddPayment();
        }}
        title={t('loan.addPayment')}
        footer={
          <button
            type="submit"
            form="payment-form-add"
            disabled={paymentFormSubmitting}
            className={BTN_SUBMIT_CLASS}
          >
            {paymentFormSubmitting ? (
              <Loader variant="on-button" />
            ) : (
              <>
                <FiPlus />
                <span>{t('loan.addPayment')}</span>
              </>
            )}
          </button>
        }
      >
        <PaymentForm
          key={
            showAddPaymentModal
              ? `add-${prefillNextPayment ? 'prefill' : 'empty'}-${addPaymentValues.field_date}-${addPaymentValues.field_pay_installment}`
              : 'add-closed'
          }
          formType="add"
          values={addPaymentValues}
          startDate={loan.sdt}
          endDate={loan.edt}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, isSubmitting) => {
            setPaymentFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            closeAddPayment();
            if (navigator.onLine && apiClient) {
              fetchLoansService(apiClient, dataDispatch);
            }
          }}
        />
      </VaulDrawer>

      {/* Floating Action Button */}
      <button
        onClick={() => openAddPayment(false)}
        className={FAB_CLASS}
        title={t('loan.addPayment')}
      >
        <FiPlus />
      </button>

    </div>
  );
};

export default Loan;
