/**
 * Income data derived from expense store (same API response).
 * Fine-grained selectors to avoid re-renders when only expense data changes.
 */
import { useStore } from '@tanstack/react-store';
import type { DataItems } from '@shared/type/types';
import { expenseStore } from './expenseStore';

export function useIncomeData(): {
  incomeData: DataItems['incomeData'];
  incomeTotals: DataItems['incomeTotals'];
} {
  return useStore(expenseStore, (s) => ({
    incomeData: s.incomeData,
    incomeTotals: s.incomeTotals ?? null,
  }));
}

export function useIncomeTotals(): Record<string, number> | null {
  return useStore(expenseStore, (s) => s.incomeTotals ?? null);
}
