import React, { useEffect, useState } from 'react';
import LoanDetails from '@components/LoanDetails';
import LoanForm from '@components/LoanForm';
import Paydown from '@utils/paydown-node';
import Modal from '@components/Modal';
import { useParams } from 'react-router-dom';
import PaymentDetails from '@components/PaymentDetails';
import { useLoan } from '@context/loan';
import { useAuthDispatch, useAuthState } from '@context/context';
import { AuthState } from '@type/types';
import {
  fetchLoans,
  transformToNumber,
  transformDateFormat,
} from '@utils/utils';
import { FaPen } from 'react-icons/fa';
import Notification from '@components/Notification';

const Loan = () => {
  const { id } = useParams();
  const { data, dataDispatch } = useLoan();
  const { token } = useAuthState() as AuthState;
  const dispatch = useAuthDispatch();
  const [showEditModal, setShowEditModal] = useState(false);
  const { loans } = data;
  const noData = data.loans === null;
  useEffect(() => {
    if (noData) {
      fetchLoans(token, dataDispatch, dispatch);
    }
  }, [data, dataDispatch, noData, token, dispatch]);

  const loan = loans?.find((item) => item.id === id);
  if (!loan)
    return (
      <>
        <div className="lds-ripple">
          <div></div>
          <div></div>
        </div>
      </>
    );

  const [filteredData] =
    data?.payments?.filter(
      (item) => item?.loanId === id && item?.data?.length > 0
    ) || [];

  const payments =
    filteredData?.data?.map((item) => {
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
    day_count_method: 'act/365',
    ...(loan.fif
      ? {
          initial_fee: transformToNumber(loan.fif),
        }
      : {}),
    ...(loan.pdt
      ? {
          recurring: {
            first_payment_date: transformDateFormat(loan.pdt),
            ...(loan.frpd ? { payment_day: transformToNumber(loan.frpd) } : {}),
          },
        }
      : {}),
  };

  const amortizationSchedule = [];
  let paydown;
  const calculator = new Paydown();
  let errorMessage;

  try {
    paydown = calculator.calculate(loanData, payments, amortizationSchedule);
  } catch (err) {
    console.log(err);
    errorMessage = err?.message;
  }

  const totalPaidAmount = filteredData?.data?.reduce((sum, item) => {
    return sum + parseFloat(item.fpi || 0);
  }, 0);

  return (
    <div>
      <h2>
        {loan?.title} <FaPen onClick={() => setShowEditModal(true)} />
      </h2>
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
            field_loan_status: Number(loan.fls),
          }}
          onSuccess={() => {
            setShowEditModal(false);
            fetchLoans(token, dataDispatch, dispatch);
          }}
        />
      </Modal>

      <PaymentDetails
        loan={loan}
        payments={filteredData?.data || []}
        totalPaidAmount={totalPaidAmount}
      />
      {errorMessage ? (
        <Notification message={errorMessage} type="error" />
      ) : null}
      <LoanDetails
        loanData={loanData}
        loan={paydown}
        amortizationSchedule={amortizationSchedule}
        totalPaidAmount={totalPaidAmount}
      />
    </div>
  );
};

export default Loan;
