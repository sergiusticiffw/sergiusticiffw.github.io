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

  return (
    <div className="loan-container">
      {/* Header Section */}
      <div className="loan-header">
        <div className="header-content">
          <div className="header-info">
            <h1 className="loan-title">{loan?.title}</h1>
            <p className="loan-subtitle">Loan Details & Payment Tracking</p>
          </div>
          <div className="header-actions">
            <button
              onClick={() => setShowEditModal(true)}
              className="action-btn"
            >
              <FaPen />
              Edit Loan
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="error-message">
          <Notification message={errorMessage} type="error" />
        </div>
      )}

      {/* Payment Actions */}
      <div className="payment-actions">
        <button
          onClick={() => setShowAddPaymentModal(true)}
          className="action-btn"
        >
          <FaMoneyBillWave />
          Add Payment
        </button>
      </div>

      {/* Loan Sections */}
      <div className="loan-sections">
        {/* Loan Details Section */}
        <div className="loan-section">
          <div
            className="section-header accordion-header"
            onClick={() => setIsLoanInfoExpanded(!isLoanInfoExpanded)}
          >
            <div className="header-content">
              <FaHandHoldingUsd />
              <h3>Loan Information</h3>
            </div>
            <div className="accordion-icon">
              {isLoanInfoExpanded ? <FaChevronUp /> : <FaChevronDown />}
            </div>
          </div>

          <div
            className={`loan-details-grid accordion-content ${isLoanInfoExpanded ? 'expanded' : 'collapsed'}`}
          >
            <div className="detail-item">
              <div className="detail-label">Principal Amount</div>
              <div className="detail-value">{formatNumber(totalPrincipal)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Interest Rate</div>
              <div className="detail-value">{loan.fr}%</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Total Interests</div>
              <div className="detail-value">{formatNumber(sumOfInterest)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Total Fees</div>
              <div className="detail-value">{formatNumber(totalFees)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Days Calculated</div>
              <div className="detail-value">{daysCalculated}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Days Remaining</div>
              <div className="detail-value">{daysRemaining}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Days Passed</div>
              <div className="detail-value">{daysPassed}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Interest Cost %</div>
              <div className="detail-value">
                {formatNumber(interestCostPercentage)}%
              </div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Cost per Day</div>
              <div className="detail-value">{formatNumber(payPerDay)}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Start Date</div>
              <div className="detail-value">{loan.sdt}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">End Date</div>
              <div className="detail-value">{loan.edt}</div>
            </div>
            {loan.fif && (
              <div className="detail-item">
                <div className="detail-label">Initial Fee</div>
                <div className="detail-value">{formatNumber(loan.fif)}</div>
              </div>
            )}
            {loan.pdt && (
              <div className="detail-item">
                <div className="detail-label">First Payment Date</div>
                <div className="detail-value">{loan.pdt}</div>
              </div>
            )}
            <div className="detail-item">
              <div className="detail-label">Actual End Date</div>
              <div className="detail-value">{paydown?.actual_end_date}</div>
            </div>
            <div className="detail-item">
              <div className="detail-label">Latest Payment Date</div>
              <div className="detail-value">{paydown?.latest_payment_date}</div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        <div className="loan-section loan-progress-section">
          <div className="section-header">
            <FaChartLine />
            <h3>Payment Progress</h3>
          </div>

          <div className="progress-overview">
            <div className="progress-item">
              <div className="progress-value">
                {formatNumber(totalPrincipal)}
              </div>
              <div className="progress-label">Total Principal</div>
            </div>
            <div className="progress-item">
              <div className="progress-value">
                {formatNumber(totalInstallments)}
              </div>
              <div className="progress-label">Total Installments</div>
            </div>
            <div className="progress-item">
              <div className="progress-value">
                {formatNumber(totalPaidAmount)}
              </div>
              <div className="progress-label">Amount Paid</div>
            </div>
            <div className="progress-item">
              <div className="progress-value">
                {formatNumber(remainingAmount)}
              </div>
              <div className="progress-label">Remaining</div>
            </div>
            <div className="progress-item">
              <div className="progress-value">{formatNumber(progress)}%</div>
              <div className="progress-label">Progress</div>
            </div>
          </div>

          <div className="progress-bar-container">
            <div className="progress-label">
              <span>Payment Progress</span>
              <span>{formatNumber(progress)}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Payment Details Section */}
        <div className="loan-section">
          <div className="section-header">
            <FaMoneyBillWave />
            <h3>Payment History</h3>
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
            <h3>Amortization Schedule</h3>
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
