import React, { useEffect, useMemo, useState } from 'react';
import LoanDetails from '@features/loans/components/Loan/LoanDetails';
import LoanForm from '@features/loans/components/Loan/LoanForm';
import VaulDrawer from '@shared/components/VaulDrawer';
import { useParams } from '@tanstack/react-router';
import PaymentDetails from '@features/loans/components/Loan/PaymentDetails';
import PaymentForm from '@features/loans/components/Loan/PaymentForm';
import { LoadingSpinner } from '@shared/components/Common';
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
import { isEarlyPaymentFromApiItem } from '@features/loans/utils/amortization';
import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import {
  FiTrendingUp,
  FiDollarSign,
  FiEdit2,
  FiPlus,
  FiCheckCircle,
  FiCreditCard,
  FiBarChart2,
  FiCheck,
  FiClock,
  FiPercent,
  FiTrendingDown,
  FiCalendar,
  FiAlertCircle,
} from 'react-icons/fi';
import Notification from '@shared/components/Notification/Notification';
import { useLocalization } from '@shared/context/localization';
import { usePendingSyncIds } from '@shared/hooks/usePendingSyncIds';
import { useChartsThemeSync } from '@shared/context/highcharts';

const Loan: React.FC = () => {
  useChartsThemeSync();
  const { id } = useParams({ from: '/expenses/loan/$id' });
  const { data, dataDispatch } = useLoan();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [loanFormEditSubmitting, setLoanFormEditSubmitting] = useState(false);
  const [paymentFormSubmitting, setPaymentFormSubmitting] = useState(false);
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
  const scheduledPaymentItems = useMemo(
    () => paymentsForLoan.filter((item) => !isEarlyPaymentFromApiItem(item)),
    [paymentsForLoan]
  );
  const amort = useAmortization(loan ?? null, paymentsForLoan);
  const scheduledAmort = useAmortization(loan ?? null, scheduledPaymentItems);

  if (!loan) {
    return (
      <div className="page-container">
        <LoadingSpinner />
      </div>
    );
  }

  const loanStatus = getLoanStatus(String(loan?.fls ?? ''));
  const paydown = amort.paydown;
  const amortizationSchedule = amort.schedule;
  const errorMessage = amort.error;
  const hasEarlyPayments = paymentsForLoan.some(isEarlyPaymentFromApiItem);

  let interestSavings = 0;
  if (
    (loanStatus === 'active' || loanStatus === 'completed') &&
    hasEarlyPayments &&
    paydown &&
    scheduledAmort.paydown
  ) {
    const interestWithoutEarlyPayments =
      scheduledAmort.paydown.sum_of_interests ?? 0;
    const interestWithEarlyPayments = paydown.sum_of_interests ?? 0;
    interestSavings = Math.max(
      0,
      interestWithoutEarlyPayments - interestWithEarlyPayments
    );
    if (interestSavings > interestWithEarlyPayments * 10) {
      interestSavings = 0;
    }
  }

  const loanData = {
    start_date: transformDateFormat(loan.sdt ?? ''),
    end_date: transformDateFormat(loan.edt ?? ''),
    principal: transformToNumber(loan.fp ?? 0),
    rate: transformToNumber(loan.fr ?? 0),
  };

  const totalPaidAmount =
    filteredData?.data?.reduce(
      (sum: number, item: ApiPaymentItem) =>
        sum + parseFloat(String(item.fpi ?? '0')),
      0
    ) ?? 0;

  const calculateProgress = () => {
    if (loanStatus === 'completed') return 100;
    if (loanStatus === 'pending') return 0;
    if (!loan.fp || !paydown) return 0;

    const sumInstallments = paydown.sum_of_installments || 0;

    if (sumInstallments === 0) return 0;

    const progressValue = ((totalPaidAmount ?? 0) / sumInstallments) * 100;

    return Math.max(0, Math.min(progressValue, 100));
  };

  const progress = calculateProgress();

  // Get correct values for display
  const totalPrincipal = parseFloat(String(loan.fp ?? '0'));
  const totalInstallments =
    paydown?.sum_of_installments +
      paydown?.remaining_principal +
      paydown?.unpaid_interest +
      paydown?.sum_of_fees || 0;
  const remainingAmount = totalInstallments - (totalPaidAmount ?? 0);
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

  // Remaining amount display - don't show amount for completed or pending loans
  const remainingDisplay =
    loanStatus === 'completed' || loanStatus === 'pending'
      ? loanStatus === 'completed'
        ? t('common.completed')
        : t('loan.notStarted')
      : formatNumber(remainingAmount);

  // Get total interest paid from paydown calculation
  const interestPaid =
    loanStatus === 'pending' || !paydown ? 0 : paydown.interest_paid || 0;
  const interestPaidDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : formatNumber(interestPaid);

  // Interest savings is calculated above (outside paydown calculation)
  const interestSavingsValue =
    loanStatus === 'pending' || !paydown ? 0 : interestSavings;
  const interestSavingsDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : interestSavingsValue > 0
        ? formatNumber(interestSavingsValue)
        : formatNumber(0);

  // Get principal paid from paydown calculation
  const principalPaid =
    loanStatus === 'pending' || !paydown
      ? 0
      : totalPaidAmount - interestPaid || 0;
  const principalPaidDisplay =
    loanStatus === 'pending'
      ? t('loan.notStarted')
      : formatNumber(principalPaid);

  // Get remaining principal from paydown calculation
  const remainingPrincipal =
    loanStatus === 'pending' || !paydown
      ? 0
      : totalPrincipal - principalPaid || 0;
  const remainingPrincipalDisplay =
    loanStatus === 'pending' || loanStatus === 'completed'
      ? loanStatus === 'completed'
        ? t('common.completed')
        : t('loan.notStarted')
      : formatNumber(remainingPrincipal);

  return (
    <div className="page-container loan-container">
      {/* Header - same structure as NewHome */}
      <div className="loan-header">
        <h1>{loan?.title}</h1>
      </div>

      {/* Payment Actions */}
      <div className="btns-actions">
        <button onClick={() => setShowEditModal(true)} className="action-btn">
          <FiEdit2 />
          {t('loan.editLoan')}
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="error-message">
          <Notification message={errorMessage} type="error" />
        </div>
      )}

      {/* Loan Stats */}
      <div className="loan-stats-grid-2col">
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiCalendar
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.startDate')}
          </span>
          <span className="loan-stat-value">
            {loanData.start_date || '-'}
          </span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiCalendar
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.endDate')}
          </span>
          <span className="loan-stat-value">
            {loanData.end_date ||
              (amortizationSchedule.length > 0
                ? (() => {
                    const lastRow = amortizationSchedule[amortizationSchedule.length - 1];
                    if (Array.isArray(lastRow)) {
                      return lastRow[0] || '-';
                    }
                    return lastRow?.date || '-';
                  })()
                : '-')}
          </span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiCreditCard
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.principal')}
          </span>
          <span className="loan-stat-value">
            {formatNumber(totalPrincipal)}
          </span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiBarChart2
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('common.total')}
          </span>
          <span className="loan-stat-value">
            {formatNumber(totalInstallments)}
          </span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiCheck
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.paid')}
          </span>
          <span className="loan-stat-value">
            {formatNumber(totalPaidAmount)}
          </span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiClock
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.remaining')}
          </span>
          <span className="loan-stat-value">{remainingDisplay}</span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiPercent
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.currentInterest')}
          </span>
          <span className="loan-stat-value">{interestPaidDisplay}</span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiTrendingDown
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.interestSavings')}
          </span>
          <span className="loan-stat-value">{interestSavingsDisplay}</span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiCheckCircle
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.principalPaid')}
          </span>
          <span className="loan-stat-value">{principalPaidDisplay}</span>
        </div>
        <div className="loan-stat-item">
          <span className="loan-stat-label">
            <FiAlertCircle
              style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
            />
            {t('loan.remainingPrincipal')}
          </span>
          <span className="loan-stat-value">{remainingPrincipalDisplay}</span>
        </div>
      </div>

      {/* Loan Sections */}
      <div className="loan-sections">
        {/* Progress Section */}
        <div className="loan-section loan-progress-section">
          <div className="section-header">
            <FiTrendingUp />
            <h3>{t('loan.paymentProgress')}</h3>
          </div>

          <div className="progress-container">
            <div className="progress-bar-container">
              <div className="progress-label">
                <span>{t('loan.paymentProgress')}</span>
                <span>{formatNumber(progress)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>

            <div className="loan-stats-grid-2col">
              <div className="loan-stat-item">
                <span className="loan-stat-label">
                  <FiCalendar
                    style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
                  />
                  {t('loan.monthsPassed')}
                </span>
                <span className="loan-stat-value">{monthsPassedDisplay}</span>
              </div>
              <div className="loan-stat-item">
                <span className="loan-stat-label">
                  <FiClock
                    style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}
                  />
                  {t('loan.daysRemaining')}
                </span>
                <span className="loan-stat-value">{daysRemainingDisplay}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details Section */}
        <div className="loan-section">
          <div className="section-header">
            <FiDollarSign />
            <h3>{t('loan.paymentHistory')}</h3>
          </div>
          <PaymentDetails
            loan={loan}
            payments={filteredData?.data || []}
            totalPaidAmount={totalPaidAmount}
            pendingSyncIds={pendingPaymentIds}
          />
        </div>

        {/* Loan Details Section */}
        <div className="loan-section">
          <div className="section-header">
            <FiTrendingUp />
            <h3>{t('loan.amortizationSchedule')}</h3>
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
          formType={'edit'}
          values={{
            nid: loan.id,
            title: loan.title,
            field_principal: loan.fp,
            field_start_date: loan.sdt,
            field_end_date: loan.edt,
            field_rate: loan.fr,
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
          setShowAddPaymentModal(false);
        }}
        title={t('loan.addPayment')}
        footer={
          <button
            type="submit"
            form="payment-form-add"
            disabled={paymentFormSubmitting}
            className="btn-submit"
          >
            {paymentFormSubmitting ? (
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
        <PaymentForm
          formType="add"
          values={{
            nid: '',
            title: '',
            field_date: new Date().toISOString().slice(0, 10),
            field_rate: 0,
            field_pay_installment: 0,
            field_pay_single_fee: 0,
            field_new_recurring_amount: 0,
          }}
          startDate={loan.sdt}
          endDate={loan.edt}
          hideSubmitButton={true}
          onFormReady={(_submitHandler, isSubmitting) => {
            setPaymentFormSubmitting(isSubmitting);
          }}
          onSuccess={() => {
            setShowAddPaymentModal(false);
            // UI update is handled by useFormSubmit, only fetch if online
            if (navigator.onLine && apiClient) {
              fetchLoansService(apiClient, dataDispatch);
            }
          }}
        />
      </VaulDrawer>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowAddPaymentModal(true)}
        className="fab"
        title={t('loan.addPayment')}
      >
        <FiPlus />
      </button>
    </div>
  );
};

export default Loan;
