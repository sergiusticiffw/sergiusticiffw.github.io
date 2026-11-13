import type {
  ApiLoan,
  ApiPaymentItem,
  TransactionOrIncomeItem,
} from '@shared/type/types';
import type { TagCatalog, TagMode } from '../tags/catalog';

export type DataProviderKind = 'drupal' | 'supabase';

export interface ProviderUser {
  uid: string;
  /** Google email — stable across Drupal ↔ Supabase for the same person. */
  email?: string;
  name?: string;
  currency?: string;
  encryption_status?: string;
}

/** Provider-agnostic session stored in localStorage (`currentUser`). */
export interface AuthSession {
  current_user: ProviderUser;
  /** Canonical token for API calls. */
  access_token: string;
  /** Legacy alias kept for Drupal-era readers / AuthReducer. */
  jwt_token: string;
  refresh_token?: string;
  provider: DataProviderKind;
}

export interface ProviderResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

/** Normalized write response — maps Drupal `nid` or Supabase `id`. */
export interface WriteResult {
  id: string;
  raw?: unknown;
}

/** Portable prefs synced in `profiles.preferences` (Supabase). */
export type ProfilePreferences = {
  v: 1;
  theme?: string;
  language?: 'en' | 'ro' | string;
  onboardingComplete?: boolean;
  goalsEnabled?: boolean;
  visibleCharts?: string[];
  customChartsEnabled?: boolean;
  aiLanguage?: string;
  aiShareDescriptions?: boolean;
  aiChat?: unknown;
  emergencyFund?: Record<string, unknown>;
};

export interface UserProfile {
  uid: string;
  currency?: string;
  encryption_status?: string;
  gemini_api_key?: string;
  tag_mode?: TagMode;
  custom_tags?: TagCatalog['custom'];
  preferences?: ProfilePreferences | Record<string, unknown>;
  /** Raw provider payload when callers need Drupal field shapes. */
  raw?: Record<string, unknown>;
}

export interface ProfilePatch {
  currency?: string;
  encryption_status?: string;
  gemini_api_key?: string | null;
  tag_mode?: TagMode;
  custom_tags?: TagCatalog['custom'];
  preferences?: ProfilePreferences | Record<string, unknown>;
}

export type TransactionRecord = TransactionOrIncomeItem & {
  encrypted_payload?: string | null;
};

export type LoanRecord = ApiLoan & {
  encrypted_payload?: string | null;
};

export type PaymentRecord = ApiPaymentItem & {
  id?: string;
  encrypted_payload?: string | null;
  loan_id?: string;
};

export type HouseholdRole = 'owner' | 'admin' | 'member';
export type HouseholdInviteStatus =
  | 'pending'
  | 'accepted'
  | 'revoked'
  | 'expired';

export interface HouseholdMember {
  user_id: string;
  role: HouseholdRole;
  joined_at?: string;
  email?: string;
  name?: string;
}

export interface HouseholdInvite {
  id: string;
  email: string;
  status: HouseholdInviteStatus;
  invited_by: string;
  created_at?: string;
  expires_at?: string;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  my_role?: HouseholdRole;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  shared_categories: string[];
}

/** Aggregated family spend — no individual partner transactions. */
export interface FamilyCategoryTotal {
  category_id: string;
  /** YYYY-MM */
  month: string;
  total: number;
}

export type { ApiLoan, ApiPaymentItem, TransactionOrIncomeItem, TagCatalog };
