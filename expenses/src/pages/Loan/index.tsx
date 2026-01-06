import React, { useEffect, useState } from 'react';
import LoanDetails from '@components/Loan/LoanDetails';
import LoanForm from '@components/Loan/LoanForm';
import Paydown from '@utils/paydown-node';
import Modal from '@components/Modal/Modal';
import { useParams } from 'react-router-dom';
import PaymentDetails from '@components/Loan/PaymentDetails';
import PaymentForm from '@components/Loan/PaymentForm';
import { LoadingSpinner } from '@components/Common';
import { useLoan } from '@context/loan';
import {
  calculateDaysFrom,
  formatNumber,
  transformDateFormat,
  transformToNumber,
  getLoanStatus,
} from '@utils/utils';
import { fetchLoans as fetchLoansService } from '@api/loans';
import { useApiClient } from '@hooks/useApiClient';
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
import Notification from '@components/Notification/Notification';
import './Loan.scss';
import { useLocalization } from '@context/localization';

const Loan: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, dataDispatch } = useLoan();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [loanFormEditSubmitting, setLoanFormEditSubmitting] = useState(false);
  const [paymentFormSubmitting, setPaymentFormSubmitting] = useState(false);
  const { loans } = data;
  const noData = data.loans === null;
  const { t } = useLocalization();
  const apiClient = useApiClient();

  useEffect(() => {
    if (noData && apiClient) {
      fetchLoansService(apiClient, dataDispatch);
    }
  }, [data, dataDispatch, noData, apiClient]);

  const loan = loans?.find((item: any) => item.id === id);
  const loanStatus = getLoanStatus(loan?.fls);

  if (!loan)
    return (
      <div className="page-container">
        <LoadingSpinner />
      </div>
    );

  const [filteredData] =
    data?.payments?.filter(
      (item: any) => item?.loanId === id && item?.data?.length > 0
    ) || [];

  // Filter payments to only include actual paid payments (not simulated)
  const allPayments =
    filteredData?.data?.map((item: any) => {
      return {
        title: item.title,
        isSimulatedPayment: Number(item.fisp),
        date: transformDateFormat(item.fdt),
        ...(item.fr ? { rate: transformToNumber(item.fr) } : {}),
        ...(item.fpi ? { pay_installment: transformToNumber(item.fpi) } : {}),
        ...(item.fpsf ? { pay_single_fee: transformToNumber(item.fpsf) } : {}),
        ...(item.fnra
          ? { recurring_amount: transformToNumber(item.fnra) }
          : {}),
      };
    }) || [];

  const loanData = {
    start_date: transformDateFormat(loan.sdt),
    end_date: transformDateFormat(loan.edt),
    principal: transformToNumber(loan.fp),
    rate: transformToNumber(loan.fr),
    day_count_method: 'act/365' as const,
    ...(loan.fif
      ? {
          initial_fee: transformToNumber(loan.fif),
        }
      : {}),
    ...(loan.pdt && loan.frpd
      ? {
          recurring: {
            first_payment_date: transformDateFormat(loan.pdt),
            payment_day: transformToNumber(loan.frpd),
          },
        }
      : {}),
  };

  const amortizationSchedule: any[] = [];
  let paydown: any;
  const calculator = Paydown();
  let errorMessage: string | undefined;

  try {
    paydown = calculator.calculate(loanData, allPayments, amortizationSchedule);
  } catch (err: any) {
    errorMessage = err?.message;
  }

  // Calculate interest savings from early payments
  // Only calculate if there are payments with title "Anticipat" and loan is active
  // This is done by comparing:
  // 1. Interest with all payments (actual scenario - already calculated above)
  // 2. Interest with only scheduled payments (Regular + rate/fee changes)
  let interestSavings = 0;

  // Helper function to check if a payment is an early/advance payment
  const isEarlyPayment = (payment: any): boolean => {
    if (!payment.title) return false;
    const titleLower = payment.title.toLowerCase();

    // Romanian variants
    if (
      titleLower.includes('anticipat') ||
      titleLower.includes('avans') ||
      titleLower.includes('înainte') ||
      titleLower.includes('inainte') ||
      titleLower.includes('prematur') ||
      titleLower.includes('extra') ||
      titleLower.includes('suplimentar')
    ) {
      return true;
    }

    // English variants
    if (
      titleLower.includes('early') ||
      titleLower.includes('advance') ||
      titleLower.includes('premature') ||
      titleLower.includes('extra') ||
      titleLower.includes('additional')
    ) {
      return true;
    }

    return false;
  };

  // Check if there are any early payments
  const hasEarlyPayments = allPayments.some(isEarlyPayment);

  // Calculate interest savings if:
  // 1. Loan is active or completed
  // 2. There are early payments detected
  // 3. Paydown calculation succeeded
  // Note: We removed the requirement for recurring config to allow calculation for all loans
  if (
    (loanStatus === 'active' || loanStatus === 'completed') &&
    hasEarlyPayments &&
    paydown
  ) {
    try {
      // Filter out early payments to get scheduled payments only
      // Scheduled payments include:
      // - All payments that are NOT early payments (inverse logic)
      // - This includes regular payments, rate changes, fee changes, recurring_amount changes
      // - Basically everything except explicitly marked early payments
      const scheduledPayments = allPayments.filter((payment: any) => {
        // Exclude early payments
        if (isEarlyPayment(payment)) {
          return false;
        }
        // Include all other payments (regular, rate changes, fee changes, etc.)
        return true;
      });

      // Calculate paydown with only scheduled payments
      const scheduledAmortizationSchedule: any[] = [];
      const scheduledCalculator = Paydown();
      const scheduledPaydown = scheduledCalculator.calculate(
        loanData,
        scheduledPayments,
        scheduledAmortizationSchedule
      );

      // Interest without early payments (scheduled scenario)
      const interestWithoutEarlyPayments =
        scheduledPaydown?.sum_of_interests || 0;

      // Interest with early payments (actual scenario)
      const interestWithEarlyPayments = paydown?.sum_of_interests || 0;

      // Savings = difference
      interestSavings = Math.max(
        0,
        interestWithoutEarlyPayments - interestWithEarlyPayments
      );

      // Validate: savings should be reasonable
      // Only reject if savings are unreasonably large (more than 10x the actual interest)
      if (interestSavings > interestWithEarlyPayments * 10) {
        // Likely calculation error, set to 0
        interestSavings = 0;
      }
    } catch (err) {
      // If calculation fails, set to 0
      interestSavings = 0;
    }
  }

  const totalPaidAmount = filteredData?.data?.reduce(
    (sum: number, item: any) => {
      return sum + parseFloat(item.fpi || '0');
    },
    0
  );

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
  const totalPrincipal = parseFloat(loan.fp || '0');
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

      {/* Edit Loan Modal */}
      <Modal
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
      </Modal>

      {/* Add Payment Modal */}
      <Modal
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
          onFormReady={(submitHandler, isSubmitting) => {
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
      </Modal>

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
