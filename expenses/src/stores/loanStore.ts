/**
 * Loans and payments. Amortization: pure logic in @utils/amortization;
 * memoized via useAmortization (single loan) or useMemo amortization map (Loans list).
 */
import { Store, useStore } from '@tanstack/react-store';
import { initialLoanData, LoanReducer } from '@shared/context/reducer';
import type { LoanState, LoanAction } from '@shared/type/types';
export type { LoanAction };

const loanStore = new Store<LoanState>(initialLoanData as LoanState);

function loanDispatch(action: LoanAction): void {
  loanStore.setState((state) => LoanReducer(state, action) as LoanState);
}

export function useLoan(): {
  data: LoanState;
  dataDispatch: typeof loanDispatch;
} {
  const data = useStore(loanStore);
  return { data, dataDispatch: loanDispatch };
}

export function useLoanList(): LoanState['loans'] {
  return useStore(loanStore, (s) => s.loans);
}

export function useLoanPayments(): LoanState['payments'] {
  return useStore(loanStore, (s) => s.payments);
}

export function useLoanLoading(): boolean {
  return useStore(loanStore, (s) => s.loading);
}

export { loanStore, loanDispatch };
