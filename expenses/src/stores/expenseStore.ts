/**
 * Single source of truth for expenses + transactions data.
 * Typed actions only; derived state via selectors.
 */
import { Store, useStore } from '@tanstack/react-store';
import { DataReducer, initialData } from '@shared/context/reducer';
import type {
  DataItems,
  DataState,
  ExpenseAction,
  TransactionOrIncomeItem,
} from '@shared/type/types';

const expenseStore = new Store<DataItems>(initialData as DataItems);

export function expenseDispatch(action: ExpenseAction): void {
  expenseStore.setState((state) => DataReducer(state, action));
}

export function useExpenseData(): DataState {
  const data = useStore(expenseStore);
  return { data, dataDispatch: expenseDispatch };
}

export function useExpenseRaw(): TransactionOrIncomeItem[] {
  return useStore(expenseStore, (s) => s.raw);
}

export function useExpenseLoading(): boolean {
  return useStore(expenseStore, (s) => s.loading);
}

/** Derived: whether any filter is active. */
export function useHasActiveFilters(): boolean {
  return useStore(expenseStore, (s) => {
    const { category, textFilter, selectedTag, dateRange } = s;
    const hasDateRange = dateRange?.start && dateRange?.end;
    return !!(category || textFilter || selectedTag || hasDateRange);
  });
}

/** Derived: filtered view or full data (for list/charts). */
export function useExpenseFilteredOrFull(): Pick<
  DataItems,
  'groupedData' | 'totals' | 'filtered' | 'incomeTotals'
> {
  return useStore(expenseStore, (s) => {
    const source = s.filtered ?? s;
    return {
      groupedData: source.groupedData ?? null,
      totals: source.totals ?? null,
      filtered: s.filtered ?? null,
      incomeTotals: s.incomeTotals ?? null,
    };
  });
}

/**
 * For chart components: subscribe only to the "view" (filtered or full).
 * Re-renders only when this reference changes, not on unrelated store updates.
 */
export function useExpenseChartView(): DataItems {
  return useStore(expenseStore, (s) => s.filtered ?? s);
}

export { expenseStore };
