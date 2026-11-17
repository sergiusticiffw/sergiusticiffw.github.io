import type { ApiLoan, ApiPaymentItem, LoanPaymentsEntry } from '@shared/type/types';
import { getLoanStatus } from '@shared/utils/utils';
import {
  buildEventsFromApiPayments,
  buildLoanDataFromApiLoan,
  calculatePaydownOnly,
} from '@features/loans/utils/amortization';
import type { LoanLiability } from './model';

const roundWhole = (value: number) => Math.round(value);

const paymentsForLoan = (
  loanId: string,
  payments: LoanPaymentsEntry[] | null | undefined
): ApiPaymentItem[] => {
  const entry = (payments || []).find((item) => item.loanId === loanId);
  return (entry?.data || []) as ApiPaymentItem[];
};

/** Actual (non-simulated) installment total paid — same rule as Loan detail. */
const sumInstallmentsPaid = (items: ApiPaymentItem[]): number => {
  let sum = 0;
  for (const item of items) {
    if (Number(item.fisp ?? 0) !== 0) continue;
    sum += parseFloat(String(item.fpi ?? '0')) || 0;
  }
  return sum;
};

const liability = (input: {
  id: string;
  name: string;
  principal: number;
  interest: number;
  status: LoanLiability['status'];
}): LoanLiability => {
  const principal = roundWhole(Math.max(0, input.principal));
  const interest = roundWhole(Math.max(0, input.interest));
  return {
    id: input.id,
    name: input.name,
    principal,
    interest,
    remaining: roundWhole(principal + interest),
    status: input.status,
  };
};

/**
 * Amount still left to pay: remaining principal + remaining interest.
 * Matches Loan detail (total schedule − paid installments), excluding fees.
 */
export const computeLoanLiabilities = (
  loans: ApiLoan[] | null | undefined,
  payments: LoanPaymentsEntry[] | null | undefined
): LoanLiability[] => {
  if (!loans?.length) return [];

  return loans.map((loan) => {
    const status = getLoanStatus(loan.fls);
    const name = String(loan.title || loan.id || 'Loan');
    const principalFallback = Math.max(
      0,
      parseFloat(String(loan.fp ?? '0')) || 0
    );

    if (status === 'completed') {
      return liability({
        id: loan.id,
        name,
        principal: 0,
        interest: 0,
        status,
      });
    }

    try {
      const loanData = buildLoanDataFromApiLoan(loan);
      if (!loanData) {
        return liability({
          id: loan.id,
          name,
          principal: principalFallback,
          interest: 0,
          status,
        });
      }

      const paymentItems =
        status === 'pending' ? [] : paymentsForLoan(loan.id, payments);
      const events = buildEventsFromApiPayments(paymentItems);
      const result = calculatePaydownOnly(loanData, events);

      // Same total as Loan detail, without fees.
      const scheduleTotal =
        (result.sum_of_installments ?? 0) +
        (result.remaining_principal ?? 0) +
        (result.unpaid_interest ?? 0);
      const installmentsPaid = sumInstallmentsPaid(paymentItems);
      const leftToPay = Math.max(0, scheduleTotal - installmentsPaid);

      const principalLeft = Math.max(
        0,
        status === 'pending'
          ? result.effective_principal ?? principalFallback
          : result.remaining_principal_after_paid ??
              result.remaining_principal ??
              principalFallback
      );

      // Cap principal to what's left overall; remainder is interest still due.
      const principal = Math.min(principalLeft, leftToPay);
      const interest = Math.max(0, leftToPay - principal);

      return liability({
        id: loan.id,
        name,
        principal,
        interest,
        status,
      });
    } catch {
      return liability({
        id: loan.id,
        name,
        principal: principalFallback,
        interest: 0,
        status,
      });
    }
  });
};
