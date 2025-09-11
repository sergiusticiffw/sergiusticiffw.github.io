import React, { useEffect, useState } from 'react';
import LoanDetails from '@components/Loan/LoanDetails';
import LoanForm from '@components/Loan/LoanForm';
import Paydown from '@utils/paydown-node';
import Modal from '@components/Modal/Modal';
import { useParams } from 'react-router-dom';
import PaymentDetails from '@components/Loan/PaymentDetails';
import PaymentForm from '@components/Loan/PaymentForm';
import { useLoan } from '@context/loan';
import { useAuthDispatch, useAuthState } from '@context/context';
import { AuthState } from '@type/types';
import {
  fetchLoans,
  transformToNumber,
  transformDateFormat,
  formatNumber,
  calculateDaysFrom,
} from '@utils/utils';
import {
  FaPen,
  FaHandHoldingUsd,
  FaChartLine,
  FaCalendarAlt,
  FaMoneyBillWave,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import Notification from '@components/Notification/Notification';
import './Loan.scss';
import { useLocalization } from '@context/localization';

const Loan: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [isLoanInfoExpanded, setIsLoanInfoExpanded] = useState(false);
  const { loans } = data;
  const noData = data.loans === null;
  const { t } = useLocalization();

  useEffect(() => {
    if (noData) {
      fetchLoans(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

  const loan = loans?.find((item: any) => item.id === id);
  if (!loan)
    return (
      <div className="loan-container">
        <div className="loading-container">
          <div className="loader">
            <span className="loader__element"></span>
            <span className="loader__element"></span>
            <span className="loader__element"></span>
          </div>
        </div>
      </div>
    );

  const [filteredData] =
    data?.payments?.filter(
      (item: any) => item?.loanId === id && item?.data?.length > 0
    ) || [];

  const payments =
    filteredData?.data?.map((item: any) => {
      return {
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
    paydown = calculator.calculate(loanData, payments, amortizationSchedule);
  } catch (err: any) {
    errorMessage = err?.message;
  }

  const totalPaidAmount = filteredData?.data?.reduce(
    (sum: number, item: any) => {
      return sum + parseFloat(item.fpi || '0');
    },
    0
  );

  const calculateProgress = () => {
    if (!loan.fp || !paydown) return 0;

    const sumInstallments = paydown.sum_of_installments || 0;
    const percentPaid = ((totalPaidAmount ?? 0) / sumInstallments) * 100;
    const percentRemaining = 100 - percentPaid;

    return percentPaid;
  };

  const progress = calculateProgress();

  // Get correct values for display
  const totalPrincipal = parseFloat(loan.fp || '0');
  const totalInstallments = paydown?.sum_of_installments || 0;
  const remainingAmount = totalInstallments - (totalPaidAmount ?? 0);
  const totalInterests = paydown?.sum_of_interests || 0;
  const totalFees = paydown?.sum_of_fees || 0;
  const daysCalculated = paydown?.days_calculated || 0;

  // Calculate additional values from the daily-average table
  const sumOfInterest = totalInterests + (paydown?.unpaid_interest || 0);
  const payPerDay = totalInstallments / daysCalculated;
  const interestCostPercentage =
    ((sumOfInterest + totalFees) / totalInstallments) * 100;

  // Calculate days passed and remaining
  const startDateParts = loanData.start_date?.split('.') || [];
  const [day, month, year] =
    startDateParts.length >= 3 ? startDateParts : ['01', '01', '2024'];
  const formattedStartDate = `${year}-${month}-${day}`;
  const daysSince = calculateDaysFrom(formattedStartDate);
  const daysPassed = daysSince > 0 ? Math.min(daysSince, daysCalculated) : 0;
  const daysRemaining = Math.max(daysCalculated - daysPassed, 0);
  
  // Calculate time-based metrics for progress section
  const monthsRemaining = Math.ceil(daysRemaining / 30);
  const monthsPassed = Math.floor(daysPassed / 30);
  const totalMonths = Math.ceil(daysCalculated / 30);

  return (
    <div className="loan-container">
      {/* Simple Header */}
      <div className="income-header">
        <h1>{loan?.title}</h1>
      </div>

      {/* Payment Actions */}
      <div className="btns-actions">
        <button onClick={() => setShowEditModal(true)} className="action-btn">
          <FaPen />
          {t('loan.editLoan')}
        </button>
        <button
          onClick={() => setShowAddPaymentModal(true)}
          className="action-btn"
        >
          <FaMoneyBillWave />
          {t('loan.addPayment')}
        </button>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="error-message">
          <Notification message={errorMessage} type="error" />
        </div>
      )}

      {/* Simple Stats */}
      <div className="loan-stats">
        <div className="stat-item">
          <span className="stat-value">{formatNumber(totalPrincipal)}</span>
          <span className="stat-label">{t('loan.principal')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(totalInstallments)}</span>
          <span className="stat-label">{t('common.total')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(totalPaidAmount)}</span>
          <span className="stat-label">{t('loan.paid')}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{formatNumber(remainingAmount)}</span>
          <span className="stat-label">{t('loan.remaining')}</span>
        </div>
      </div>

      {/* Loan Sections */}
      <div className="loan-sections">
        {/* Progress Section */}
        <div className="loan-section loan-progress-section">
          <div className="section-header">
            <FaChartLine />
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
            
            <div className="progress-details">
              <div className="progress-item">
                <span className="progress-label">{t('loan.monthsPassed')}</span>
                <span className="progress-value">{monthsPassed} / {totalMonths}</span>
              </div>
              <div className="progress-item">
                <span className="progress-label">{t('loan.daysRemaining')}</span>
                <span className="progress-value">{daysRemaining}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Details Section */}
        <div className="loan-section">
          <div className="section-header">
            <FaMoneyBillWave />
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
            <FaChartLine />
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
          onSuccess={() => {
            setShowEditModal(false);
            fetchLoans(token, dataDispatch, dispatch);
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
          onSuccess={() => {
            setShowAddPaymentModal(false);
            fetchLoans(token, dataDispatch, dispatch);
          }}
        />
      </Modal>
    </div>
  );
};

export default Loan;
