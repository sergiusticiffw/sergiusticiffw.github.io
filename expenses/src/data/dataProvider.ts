import type {
  ApiLoan,
  DataProviderKind,
  FamilyCategoryTotal,
  Household,
  LoanRecord,
  PaymentRecord,
  ProfilePatch,
  ProviderResult,
  TransactionOrIncomeItem,
  TransactionRecord,
  UserProfile,
  WriteResult,
} from './types';

export interface DataProviderHooks {
  showNotification?: (
    message: string,
    type: string,
    options?: { groupId?: string; duration?: number }
  ) => void;
  dataDispatch?: (action: unknown) => void;
  dispatch?: (action: unknown) => void;
  onSessionExpired?: () => void;
}

export interface DataProvider {
  readonly kind: DataProviderKind;

  /** Bind the active access token (and optional hooks). */
  configure(token: string, hooks?: DataProviderHooks): void;

  listTransactions(): Promise<ProviderResult<TransactionOrIncomeItem[]>>;
  createTransaction(body: unknown): Promise<ProviderResult<WriteResult>>;
  updateTransaction(
    id: string,
    body: unknown
  ): Promise<ProviderResult<WriteResult>>;
  deleteTransaction(id: string): Promise<ProviderResult<void>>;

  listLoans(): Promise<ProviderResult<ApiLoan[]>>;
  createLoan(body: unknown): Promise<ProviderResult<WriteResult>>;
  updateLoan(id: string, body: unknown): Promise<ProviderResult<WriteResult>>;
  deleteLoan(id: string): Promise<ProviderResult<void>>;

  listPayments(loanId: string): Promise<ProviderResult<PaymentRecord[]>>;
  createPayment(body: unknown): Promise<ProviderResult<WriteResult>>;
  updatePayment(
    id: string,
    body: unknown
  ): Promise<ProviderResult<WriteResult>>;
  deletePayment(id: string): Promise<ProviderResult<void>>;

  getProfile(uid: string): Promise<ProviderResult<UserProfile>>;
  updateProfile(
    uid: string,
    patch: ProfilePatch
  ): Promise<ProviderResult<UserProfile>>;

  /** Family / household (Supabase). Drupal returns unsupported. */
  getHousehold(): Promise<ProviderResult<Household | null>>;
  createHousehold(name: string): Promise<ProviderResult<Household>>;
  updateHouseholdName(name: string): Promise<ProviderResult<Household>>;
  updateSharedCategories(
    categoryIds: string[]
  ): Promise<ProviderResult<Household>>;
  inviteByEmail(email: string): Promise<ProviderResult<Household>>;
  revokeInvite(inviteId: string): Promise<ProviderResult<Household>>;
  removeMember(userId: string): Promise<ProviderResult<Household>>;
  leaveHousehold(): Promise<ProviderResult<void>>;
  acceptPendingInvites(): Promise<
    ProviderResult<{ accepted: number; already_member?: boolean }>
  >;
  /** Shared-category monthly totals for the household (aggregates only). */
  listFamilyCategoryTotals(): Promise<ProviderResult<FamilyCategoryTotal[]>>;
}

export type { TransactionRecord, LoanRecord, PaymentRecord };
