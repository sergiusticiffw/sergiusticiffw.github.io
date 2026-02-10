export interface TransactionOrIncomeItem {
  dt: string;
  id: string;
  sum: string;
  type: string;
  cat?: string;
  dsc?: string;
  cr?: number; // Created timestamp for sorting
}

export interface Daily {
  [dt: string]: number[];
}

export interface NodeData {
  changed: { value: string }[];
  created: { value: string }[];
  default_langcode: { value: boolean }[];
  field_amount: { value: string }[];
  field_date: { value: string }[];
  field_description: { value: string }[];
  langcode: { value: string }[];
  nid: { value: number }[];
  promote: { value: boolean }[];
  revision_log: { value: string }[];
  revision_timestamp: { value: string }[];
  revision_translation_affected: { value: boolean }[];
  revision_uid: { value: number }[];
  status: { value: boolean }[];
  sticky: { value: boolean }[];
  title: { value: string }[];
  type: { value: string }[];
  uid: { value: number }[];
  uuid: { value: string }[];
  vid: { value: number }[];
}

export interface AuthState {
  token: string;
  value: any;
  theme: string;
  currency: string;
  userIsLoggedIn: boolean;
  loading: boolean;
  errorMessage: null | any;
  userDetails: string | any;
  useChartsBackgroundColor: string | any;
}

export type ChangedItemEntry =
  | { type: 'new'; data: TransactionOrIncomeItem }
  | { type: 'updated'; data: TransactionOrIncomeItem }
  | { type: 'removed'; data: TransactionOrIncomeItem };

export interface DataItems {
  raw: TransactionOrIncomeItem[];
  filtered_raw?: TransactionOrIncomeItem[];
  groupedData?: Record<string, TransactionOrIncomeItem[]> | null;
  totals?: Record<string, number> | null;
  filtered?: FilteredDataResult | null;
  incomeData?: TransactionOrIncomeItem[] | null;
  incomeTotals?: Record<string, number> | null;
  categoryTotals?:
    | Record<string, { name: string; y: number }>
    | { name: string; y: number }[];
  loading: boolean;
  totalIncomePerYearAndMonth?: DataStructure;
  totalSpent: number;
  totalPerYear?: ItemTotal;
  category?: string;
  textFilter?: string;
  selectedMonth?: string;
  selectedTag?: string;
  totalsPerYearAndMonth?: DataStructure;
  totalIncomePerYear?: ItemTotal;
  changedItems: Record<string, ChangedItemEntry>;
}

export interface FilteredDataResult {
  groupedData: Record<string, TransactionOrIncomeItem[]>;
  totals: Record<string, number>;
  totalSpent: number;
  categoryTotals: Record<string, { name: string; y: number }>;
  totalsPerYearAndMonth?: DataStructure;
  totalPerYear?: ItemTotal;
}

/** Typed expense/store actions; single source for data layer. */
export type ExpenseAction =
  | {
      type: 'SET_DATA';
      raw: TransactionOrIncomeItem[];
      loading?: boolean;
      [k: string]: unknown;
    }
  | {
      type: 'FILTER_DATA';
      category?: string;
      textFilter?: string;
      selectedMonth?: string;
      selectedTag?: string;
    }
  | { type: 'REMOVE_DATA' }
  | { type: 'CLEAR_CHANGED_ITEM'; id: string };

export interface DataState {
  data: DataItems;
  dataDispatch: (action: ExpenseAction) => void;
}

export interface ItemTotal {
  [key: string]: string | number;
}

export interface LoginPayload {
  access_token: string;
}

export interface UserData {
  current_user: any;
  errors: string[];
}

export interface ActionType {
  type: string;
  id?: any;
  payload?: any;
  error?: any;
  category?: string;
  textFilter?: string;
  selectedMonth?: string;
  selectedTag?: string;
  groupedData?: Record<string, TransactionOrIncomeItem[]>;
  totals?: Record<string, number>;
  raw?: any[];
  incomeData?: any;
  incomeTotals?: Record<string, number>;
  categoryTotals?: Record<string, { name: string; y: number }>;
  loading?: boolean;
  totalSpent?: number;
  totalsPerYearAndMonth?: DataStructure;
  totalIncomePerYear?: ItemTotal;
  totalIncomePerYearAndMonth?: DataStructure;
  totalPerYear?: ItemTotal;
}

export interface Accumulator {
  groupedData: Record<string, TransactionOrIncomeItem[]>;
  totals: Record<string, number>;
  totalsPerYearAndMonth: DataStructure;
  totalPerYear: ItemTotal;
  totalSpent: number;
  categoryTotals: Record<string, { name: string; y: number }>;
}

export interface YearData {
  [month: string]: number;
}

export interface DataStructure {
  [year: string]: YearData;
}

/** API loan record (from backend / loan store). */
export interface ApiLoan {
  id: string;
  title?: string;
  sdt?: string;
  edt?: string;
  fp?: string | number;
  fr?: string | number;
  fif?: string | number;
  pdt?: string;
  frpd?: string | number;
  fls?: string | number;
  [key: string]: unknown;
}

/** Single payment item inside payments[].data[]. */
export interface ApiPaymentItem {
  fdt?: string;
  fpi?: string | number;
  fpsf?: string | number;
  fnra?: string | number;
  fr?: string | number;
  title?: string;
  fisp?: string | number;
  [key: string]: unknown;
}

/** Payments entry: { loanId, data: ApiPaymentItem[] }. */
export interface LoanPaymentsEntry {
  loanId: string;
  data: ApiPaymentItem[];
}

export interface LoanState {
  loans: ApiLoan[] | null;
  loading: boolean;
  payments: LoanPaymentsEntry[];
}

export type LoanAction = {
  type: 'SET_DATA';
  loans?: LoanState['loans'];
  payments?: LoanState['payments'];
  loading?: boolean;
};

export interface TimeSlot {
  start: string; // "08:00" (HH:mm)
  end: string;   // "09:00" (HH:mm)
}

export interface QuickAddSuggestionConfig {
  enabled: boolean;
  amount: string;
  category: string;
  description: string;
  /** 0=Sun, 1=Mon, ... 6=Sat. Empty = toate zilele */
  daysOfWeek: number[];
  /** Intervale orare în care să apară sugestia. Empty = la orice oră */
  timeSlots: TimeSlot[];
}

export interface SettingsState {
  currency: string;
  theme: string;
  useChartsBackgroundColor: boolean;
  quickAddSuggestion: QuickAddSuggestionConfig;
}
