export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: Date;
  recurring?: boolean;
}

export interface Loan {
  id: string;
  name: string;
  type: 'given' | 'taken';
  amount: number;
  interestRate: number;
  startDate: Date;
  endDate: Date;
  monthlyPayment: number;
  remainingAmount: number;
  status: 'active' | 'paid' | 'overdue';
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense';
}

export interface DashboardStats {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  activeLoans: number;
  monthlyChange: number;
}