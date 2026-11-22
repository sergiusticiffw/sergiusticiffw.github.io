import {
  createApiClient,
  API_ENDPOINTS,
  type ApiClient,
} from '@shared/api/client';
import type {
  DataProvider,
  DataProviderHooks,
} from '../../dataProvider';
import type {
  ApiLoan,
  PaymentRecord,
  ProfilePatch,
  ProviderResult,
  TransactionOrIncomeItem,
  UserProfile,
  WriteResult,
} from '../../types';
import {
  drupalBodyFromProfilePatch,
  profileFromDrupalUser,
  writeResultFromDrupalNode,
} from './mappers';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const loanRefId = (raw: unknown): string => {
  if (raw == null) return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { target_id?: unknown; target_uuid?: unknown; value?: unknown };
    return String(obj.target_id ?? obj.target_uuid ?? obj.value ?? '');
  }
  return String(raw);
};

/**
 * Drupal entity-reference expects { target_id } (int) or { target_uuid }.
 * Bare UUID strings fail with "correct primitive type" / missing entity 422s.
 * Also drop Supabase-only keys Drupal cannot accept (unknown field_* → 422).
 */
const normalizeDrupalPaymentBody = (body: unknown): unknown => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const next = { ...(body as Record<string, unknown>) };
  delete next.field_is_early_payment;
  delete next.fiep;

  const ref = next.field_loan_reference;
  const raw = Array.isArray(ref) ? ref[0] : ref;
  const id = loanRefId(raw).trim();
  if (!id) return next;

  const asInt = Number(id);
  if (Number.isFinite(asInt) && asInt > 0 && String(Math.trunc(asInt)) === id) {
    next.field_loan_reference = [{ target_id: Math.trunc(asInt) }];
  } else if (UUID_RE.test(id)) {
    next.field_loan_reference = [
      { target_type: 'node', target_uuid: id.toLowerCase() },
    ];
  } else {
    next.field_loan_reference = [{ target_id: id }];
  }
  return next;
};

export function createDrupalDataProvider(): DataProvider {
  let client: ApiClient | null = null;
  let hooks: DataProviderHooks = {};

  const ensureClient = (): ApiClient => {
    if (!client) {
      throw new Error('Drupal DataProvider is not configured (missing token)');
    }
    return client;
  };

  const asWrite = (
    response: { success: boolean; data?: any; error?: Error | null }
  ): ProviderResult<WriteResult> => {
    if (!response.success) {
      return {
        success: false,
        error: response.error || new Error('Request failed'),
      };
    }
    const write = writeResultFromDrupalNode(response.data);
    if (!write) {
      return {
        success: false,
        error: new Error('No ID returned from server'),
      };
    }
    return { success: true, data: write };
  };

  return {
    kind: 'drupal',

    configure(token: string, nextHooks: DataProviderHooks = {}) {
      hooks = nextHooks;
      client = createApiClient({
        token,
        showNotification: hooks.showNotification,
        dataDispatch: hooks.dataDispatch,
        dispatch: hooks.dispatch,
        onSessionExpired: hooks.onSessionExpired,
      });
    },

    async listTransactions() {
      const response = await ensureClient().get<TransactionOrIncomeItem[]>(
        API_ENDPOINTS.EXPENSES
      );
      return {
        success: response.success,
        data: response.data || undefined,
        error: response.error || undefined,
      };
    },

    async createTransaction(body: unknown) {
      return asWrite(await ensureClient().post(API_ENDPOINTS.CREATE_NODE, body));
    },

    async updateTransaction(id: string, body: unknown) {
      return asWrite(
        await ensureClient().patch(API_ENDPOINTS.EXPENSE(id), body)
      );
    },

    async deleteTransaction(id: string) {
      const response = await ensureClient().delete(API_ENDPOINTS.EXPENSE(id));
      return {
        success: response.success,
        error: response.error || undefined,
      };
    },

    async listLoans() {
      const response = await ensureClient().get<ApiLoan[]>(API_ENDPOINTS.LOANS);
      return {
        success: response.success,
        data: response.data || undefined,
        error: response.error || undefined,
      };
    },

    async createLoan(body: unknown) {
      return asWrite(await ensureClient().post(API_ENDPOINTS.CREATE_NODE, body));
    },

    async updateLoan(id: string, body: unknown) {
      return asWrite(await ensureClient().patch(API_ENDPOINTS.LOAN(id), body));
    },

    async deleteLoan(id: string) {
      const response = await ensureClient().delete(API_ENDPOINTS.LOAN(id));
      return {
        success: response.success,
        error: response.error || undefined,
      };
    },

    async listPayments(loanId: string) {
      const response = await ensureClient().get<PaymentRecord[]>(
        API_ENDPOINTS.LOAN_PAYMENTS(loanId)
      );
      return {
        success: response.success,
        data: response.data || undefined,
        error: response.error || undefined,
      };
    },

    async createPayment(body: unknown) {
      const normalized = normalizeDrupalPaymentBody(body) as Record<
        string,
        unknown
      >;
      const ref = normalized?.field_loan_reference;
      const raw = Array.isArray(ref) ? ref[0] : ref;
      const id = loanRefId(raw).trim();
      // UUID loan ids are almost always Supabase leftovers — Drupal has no such node.
      if (UUID_RE.test(id)) {
        return {
          success: false,
          error: new Error(
            'HTTP 422: This loan id is not a Drupal node. Open a loan from the Drupal list (or switch to Supabase), then add the payment again.'
          ),
        };
      }
      return asWrite(
        await ensureClient().post(API_ENDPOINTS.CREATE_NODE, normalized)
      );
    },

    async updatePayment(id: string, body: unknown) {
      return asWrite(
        await ensureClient().patch(
          API_ENDPOINTS.EXPENSE(id),
          normalizeDrupalPaymentBody(body)
        )
      );
    },

    async deletePayment(id: string) {
      const response = await ensureClient().delete(API_ENDPOINTS.EXPENSE(id));
      return {
        success: response.success,
        error: response.error || undefined,
      };
    },

    async getProfile(uid: string): Promise<ProviderResult<UserProfile>> {
      const response = await ensureClient().get(`/user/${uid}?_format=json`);
      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || new Error('Failed to load profile'),
        };
      }
      return {
        success: true,
        data: profileFromDrupalUser(response.data),
      };
    },

    async updateProfile(
      uid: string,
      patch: ProfilePatch
    ): Promise<ProviderResult<UserProfile>> {
      const body = drupalBodyFromProfilePatch(patch);
      const response = await ensureClient().patch(
        `/user/${uid}?_format=json`,
        body
      );
      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || new Error('Failed to update profile'),
        };
      }
      return {
        success: true,
        data: profileFromDrupalUser(response.data),
      };
    },

    async getHousehold() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async createHousehold() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async updateHouseholdName() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async updateSharedCategories() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async inviteByEmail() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async revokeInvite() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async removeMember() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async leaveHousehold() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async transferOwnership() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async deleteHousehold() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async setMemberRole() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async setMyDisplayName() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async upsertCategoryGoal() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async deleteCategoryGoal() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async listHouseholdActivity() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async acceptPendingInvites() {
      return { success: true, data: { accepted: 0 } };
    },
    async listFamilyCategoryTotals() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async listFamilyCategoryMemberTotals() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async listFamilyCategoryDailyTotals() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async listFamilyIncomeTotals() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
    async listFamilyIncomeMemberTotals() {
      return {
        success: false,
        error: new Error('Family accounts require Supabase'),
      };
    },
  };
}
