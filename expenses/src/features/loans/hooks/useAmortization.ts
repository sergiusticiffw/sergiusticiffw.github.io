/**
 * Memoized amortization for a single loan. Deterministic; recomputes only when loan or payments change.
 */
import { useMemo } from 'react';
import type { ApiLoan, ApiPaymentItem } from '@shared/type/types';
import {
  buildLoanDataFromApiLoan,
  buildEventsFromApiPayments,
  calculateAmortization,
} from '@features/loans/utils/amortization';
import type {
  PaydownResult,
  PaymentLog,
} from '@features/loans/utils/amortization';

export interface AmortizationResult {
  paydown: PaydownResult | null;
  schedule: PaymentLog[];
  error?: string;
}

export function useAmortization(
  loan: ApiLoan | null | undefined,
  paymentsForLoan: ApiPaymentItem[]
): AmortizationResult {
  const loanData = useMemo(
    () => buildLoanDataFromApiLoan(loan),
    [
      loan?.id,
      loan?.sdt,
      loan?.edt,
      loan?.fp,
      loan?.fr,
      loan?.fif,
      loan?.pdt,
      loan?.frpd,
    ]
  );

  const events = useMemo(
    () => buildEventsFromApiPayments(paymentsForLoan),
    [paymentsForLoan]
  );

  return useMemo((): AmortizationResult => {
    if (!loanData) return { paydown: null, schedule: [] };
    try {
      const { paydown, schedule } = calculateAmortization(loanData, events);
      return { paydown, schedule };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { paydown: null, schedule: [], error: message };
    }
  }, [loanData, events]);
}
