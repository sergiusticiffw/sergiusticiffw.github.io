/**
 * Build a point-in-time full-data backup snapshot for export / Drive upload.
 */
import type { ApiClient } from '@shared/api/client';
import type {
  ApiLoan,
  ExpenseAction,
  LoanAction,
  LoanPaymentsEntry,
  TransactionOrIncomeItem,
} from '@shared/type/types';
import {
  getExpensesFromDB,
  getLoansFromDB,
  getPaymentsFromDB,
  isIndexedDBAvailable,
} from '@shared/utils/indexedDB';
import { fetchExpenses } from '@features/expenses/api/expenses';
import { fetchLoans } from '@features/loans/api/loans';
import { expenseStore } from '@stores/expenseStore';
import { loanStore } from '@stores/loanStore';

export const BACKUP_KIND = 'expenses-full-backup' as const;

export interface ExpensesBackupSnapshot {
  v: 1;
  kind: typeof BACKUP_KIND;
  uid: string;
  createdAt: string;
  transactions: TransactionOrIncomeItem[];
  incomes: TransactionOrIncomeItem[];
  loans: ApiLoan[];
  payments: LoanPaymentsEntry[];
}

const splitRaw = (raw: TransactionOrIncomeItem[]) => {
  const transactions: TransactionOrIncomeItem[] = [];
  const incomes: TransactionOrIncomeItem[] = [];
  for (const item of raw) {
    if (item.type === 'incomes') incomes.push(item);
    else transactions.push(item);
  }
  return { transactions, incomes };
};

const readFromStores = (): {
  raw: TransactionOrIncomeItem[];
  loans: ApiLoan[];
  payments: LoanPaymentsEntry[];
} => {
  const raw = expenseStore.state.raw ?? [];
  const loans = loanStore.state.loans ?? [];
  const payments = loanStore.state.payments ?? [];
  return { raw, loans, payments };
};

const readFromIndexedDB = async (): Promise<{
  raw: TransactionOrIncomeItem[];
  loans: ApiLoan[];
  payments: LoanPaymentsEntry[];
}> => {
  if (!isIndexedDBAvailable()) {
    return { raw: [], loans: [], payments: [] };
  }
  const [expenses, loans, payments] = await Promise.all([
    getExpensesFromDB(),
    getLoansFromDB(),
    getPaymentsFromDB(),
  ]);
  return {
    raw: (expenses as TransactionOrIncomeItem[] | null) ?? [],
    loans: (loans as ApiLoan[] | null) ?? [],
    payments: (payments as LoanPaymentsEntry[] | null) ?? [],
  };
};

export interface BuildBackupOptions {
  apiClient?: ApiClient | null;
  expenseDispatch?: (action: ExpenseAction) => void;
  loanDispatch?: (action: LoanAction) => void;
}

/**
 * Refresh from API when online, else use stores / IndexedDB.
 * Snapshot always reflects whatever is available at call time.
 */
export async function buildBackupSnapshot(
  uid: string,
  options: BuildBackupOptions = {}
): Promise<ExpensesBackupSnapshot> {
  const { apiClient, expenseDispatch, loanDispatch } = options;

  if (navigator.onLine && apiClient && expenseDispatch && loanDispatch) {
    try {
      await Promise.all([
        fetchExpenses(apiClient, expenseDispatch),
        fetchLoans(apiClient, loanDispatch),
      ]);
    } catch {
      // Fall through to local caches below.
    }
  }

  let { raw, loans, payments } = readFromStores();
  if (raw.length === 0 && loans.length === 0 && payments.length === 0) {
    const cached = await readFromIndexedDB();
    raw = cached.raw;
    loans = cached.loans;
    payments = cached.payments;
  }

  const { transactions, incomes } = splitRaw(raw);

  return {
    v: 1,
    kind: BACKUP_KIND,
    uid: String(uid),
    createdAt: new Date().toISOString(),
    transactions,
    incomes,
    loans,
    payments,
  };
}
