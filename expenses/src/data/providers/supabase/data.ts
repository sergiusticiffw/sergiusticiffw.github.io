import { isOnline } from '@shared/utils/indexedDB';
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
import { getSupabaseClient } from './client';
import {
  loanFromRow,
  loanRowFromBody,
  paymentFromRow,
  paymentRowFromBody,
  profileFromRow,
  profileUpdateFromPatch,
  transactionFromRow,
  transactionRowFromBody,
} from './mappers';
import { isUuid, resolveEntityId } from './stableId';
import * as householdApi from './household';

export function createSupabaseDataProvider(): DataProvider {
  let token = '';
  let hooks: DataProviderHooks = {};
  let userId = '';
  /** Avoid hammering /auth/v1/token after a bad refresh. */
  let authSyncFailed = false;

  const failOffline = <T,>(): ProviderResult<T> => ({
    success: false,
    error: new Error('No internet connection'),
  });

  const readStoredAuth = () => {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || '{}') as Record<
        string,
        unknown
      >;
    } catch {
      return {};
    }
  };

  const persistClientSession = (session: {
    access_token: string;
    refresh_token: string;
  }) => {
    try {
      const stored = readStoredAuth();
      const next = {
        ...stored,
        access_token: session.access_token,
        jwt_token: session.access_token,
        refresh_token: session.refresh_token,
      };
      localStorage.setItem('currentUser', JSON.stringify(next));
      token = session.access_token;
    } catch {
      // ignore
    }
  };

  const sessionStillValid = (expiresAt: number | undefined) => {
    if (!expiresAt) return false;
    return expiresAt > Math.floor(Date.now() / 1000) + 30;
  };

  const applySession = (session: {
    access_token: string;
    refresh_token: string;
    user?: { id?: string } | null;
  }) => {
    authSyncFailed = false;
    persistClientSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    if (session.user?.id) userId = String(session.user.id);
  };

  const ensureAuth = async () => {
    const supabase = getSupabaseClient();
    const stored = readStoredAuth();
    const refresh =
      (stored.refresh_token as string | undefined) ||
      ((stored as { refreshToken?: string }).refreshToken as string | undefined) ||
      '';
    const storedUid = String(
      (stored.current_user as { uid?: string } | undefined)?.uid || ''
    );

    let { data: existing } = await supabase.auth.getSession();
    const live = existing.session;
    const liveOk =
      !!live?.access_token && sessionStillValid(live.expires_at);

    if (liveOk && live) {
      // Client already has a fresh JWT (possibly rotated by autoRefresh).
      if (live.access_token !== token || live.refresh_token !== refresh) {
        applySession(live);
      }
    } else if (!authSyncFailed) {
      // 1) Refresh via client storage first (avoids stale app refresh_token 400s).
      let restored = false;
      if (live?.refresh_token || refresh) {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session) {
          existing = data;
          applySession(data.session);
          restored = true;
        }
      }
      // 2) Fall back to restoring from app-stored tokens.
      if (!restored && token && refresh) {
        const { data, error } = await supabase.auth.setSession({
          access_token: token,
          refresh_token: refresh,
        });
        if (!error && data.session) {
          existing = data;
          applySession(data.session);
          restored = true;
        }
      }
      if (!restored) {
        authSyncFailed = true;
        if (token || refresh || live) {
          hooks.onSessionExpired?.();
        }
      }
    }

    // Prefer session / cached uid — avoid /auth/v1/user on every API call.
    const sessionUid = existing.session?.user?.id
      ? String(existing.session.user.id)
      : '';
    if (sessionUid) {
      userId = sessionUid;
    } else if (storedUid && !authSyncFailed) {
      userId = storedUid;
    } else if (authSyncFailed) {
      userId = '';
    }
    return {
      supabase,
      userId,
      authenticated: !authSyncFailed && sessionStillValid(existing.session?.expires_at),
    };
  };

  const onAuthError = (error: {
    message?: string;
    code?: string;
    status?: number;
  } | null) => {
    const msg = (error?.message || '').toLowerCase();
    if (
      msg.includes('jwt') ||
      msg.includes('session') ||
      msg.includes('refresh') ||
      msg.includes('expired') ||
      msg.includes('unauthorized') ||
      error?.code === 'PGRST301' ||
      error?.status === 401
    ) {
      authSyncFailed = true;
      hooks.onSessionExpired?.();
    }
  };

  /** PostgREST caps a single response (default 1000). Page until exhausted. */
  const PAGE_SIZE = 1000;
  const fetchAllRows = async <T,>(
    build: (from: number, to: number) => PromiseLike<{
      data: T[] | null;
      error: { message: string; code?: string } | null;
    }>
  ): Promise<{ data: T[]; error: { message: string; code?: string } | null }> => {
    const all: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await build(from, to);
      if (error) return { data: all, error };
      const chunk = data || [];
      all.push(...chunk);
      if (chunk.length < PAGE_SIZE) break;
    }
    return { data: all, error: null };
  };

  return {
    kind: 'supabase',

    configure(nextToken: string, nextHooks?: DataProviderHooks) {
      if (nextToken && nextToken !== token) {
        authSyncFailed = false;
      }
      token = nextToken;
      // Merge hooks — bare configure(token) must not wipe onSessionExpired.
      if (nextHooks) {
        hooks = { ...hooks, ...nextHooks };
      }
      try {
        const stored = JSON.parse(localStorage.getItem('currentUser') || '{}');
        userId = String(stored?.current_user?.uid || '');
      } catch {
        userId = '';
      }
    },

    async listTransactions() {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const { data, error } = await fetchAllRows((from, to) =>
          supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .range(from, to)
        );
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return {
          success: true,
          data: data.map(transactionFromRow) as TransactionOrIncomeItem[],
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async createTransaction(body: unknown) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase, userId: uid } = await ensureAuth();
        if (!uid) return { success: false, error: new Error('Not signed in') };
        const srcId = (body as { id?: unknown })?.id;
        const resolvedId = await resolveEntityId(uid, 'tx', srcId);
        const row = transactionRowFromBody(body, uid, resolvedId);
        const query = resolvedId
          ? supabase.from('transactions').upsert(row, { onConflict: 'id' })
          : supabase.from('transactions').insert(row);
        const { data, error } = await query.select('id').single();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return { success: true, data: { id: String(data.id), raw: data } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async updateTransaction(id: string, body: unknown) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase, userId: uid } = await ensureAuth();
        if (!uid) return { success: false, error: new Error('Not signed in') };
        const resolvedId =
          (await resolveEntityId(uid, 'tx', id)) ||
          (isUuid(id) ? id.toLowerCase() : id);
        const row = transactionRowFromBody(body, uid, resolvedId);
        const { data, error } = await supabase
          .from('transactions')
          .upsert(row, { onConflict: 'id' })
          .select('id')
          .single();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return {
          success: true,
          data: { id: String(data?.id || resolvedId), raw: data },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async deleteTransaction(id: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id);
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async listLoans() {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const { data, error } = await fetchAllRows((from, to) =>
          supabase
            .from('loans')
            .select('*')
            .order('created_at', { ascending: false })
            .range(from, to)
        );
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return {
          success: true,
          data: data.map(loanFromRow) as ApiLoan[],
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async createLoan(body: unknown) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase, userId: uid } = await ensureAuth();
        if (!uid) return { success: false, error: new Error('Not signed in') };
        const srcId = (body as { id?: unknown })?.id;
        const resolvedId = await resolveEntityId(uid, 'loan', srcId);
        const row = loanRowFromBody(body, uid, resolvedId);
        const query = resolvedId
          ? supabase.from('loans').upsert(row, { onConflict: 'id' })
          : supabase.from('loans').insert(row);
        const { data, error } = await query.select('id').single();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return { success: true, data: { id: String(data.id), raw: data } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async updateLoan(id: string, body: unknown) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase, userId: uid } = await ensureAuth();
        if (!uid) return { success: false, error: new Error('Not signed in') };
        const resolvedId =
          (await resolveEntityId(uid, 'loan', id)) ||
          (isUuid(id) ? id.toLowerCase() : id);
        const row = loanRowFromBody(body, uid, resolvedId);
        const { data, error } = await supabase
          .from('loans')
          .upsert(row, { onConflict: 'id' })
          .select('id')
          .single();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return {
          success: true,
          data: { id: String(data?.id || resolvedId), raw: data },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async deleteLoan(id: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const { error } = await supabase.from('loans').delete().eq('id', id);
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async listPayments(loanId: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const { data, error } = await fetchAllRows((from, to) =>
          supabase
            .from('payments')
            .select('*')
            .eq('loan_id', loanId)
            .order('fdt', { ascending: false })
            .range(from, to)
        );
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return {
          success: true,
          data: data.map(paymentFromRow) as PaymentRecord[],
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async createPayment(body: unknown) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase, userId: uid } = await ensureAuth();
        if (!uid) return { success: false, error: new Error('Not signed in') };
        const b = body as { id?: unknown; loan_id?: unknown; loanId?: unknown };
        const resolvedId = await resolveEntityId(uid, 'pay', b?.id);
        const loanSrc = b?.loan_id ?? b?.loanId;
        const resolvedLoanId = await resolveEntityId(uid, 'loan', loanSrc);
        const row = paymentRowFromBody(body, uid, resolvedId, resolvedLoanId);
        const query = resolvedId
          ? supabase.from('payments').upsert(row, { onConflict: 'id' })
          : supabase.from('payments').insert(row);
        const { data, error } = await query.select('id').single();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return { success: true, data: { id: String(data.id), raw: data } };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async updatePayment(id: string, body: unknown) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase, userId: uid } = await ensureAuth();
        if (!uid) return { success: false, error: new Error('Not signed in') };
        const b = body as { loan_id?: unknown; loanId?: unknown };
        const resolvedId =
          (await resolveEntityId(uid, 'pay', id)) ||
          (isUuid(id) ? id.toLowerCase() : id);
        const loanSrc = b?.loan_id ?? b?.loanId;
        const resolvedLoanId = await resolveEntityId(uid, 'loan', loanSrc);
        const row = paymentRowFromBody(body, uid, resolvedId, resolvedLoanId);
        const { data, error } = await supabase
          .from('payments')
          .upsert(row, { onConflict: 'id' })
          .select('id')
          .single();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return {
          success: true,
          data: { id: String(data?.id || resolvedId), raw: data },
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async deletePayment(id: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const { error } = await supabase.from('payments').delete().eq('id', id);
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async getProfile(uid: string): Promise<ProviderResult<UserProfile>> {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .maybeSingle();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        if (!data) {
          return { success: false, error: new Error('Profile not found') };
        }
        return { success: true, data: profileFromRow(data) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async updateProfile(
      uid: string,
      patch: ProfilePatch
    ): Promise<ProviderResult<UserProfile>> {
      if (!isOnline()) return failOffline();
      try {
        const { supabase, userId: authUid, authenticated } = await ensureAuth();
        if (!authenticated) {
          return {
            success: false,
            error: new Error('Not authenticated'),
          };
        }
        // RLS: auth.uid() must equal profiles.id — never upsert with a stale uid.
        const profileId = authUid || uid;
        if (!profileId) {
          return {
            success: false,
            error: new Error('Not authenticated'),
          };
        }
        const row = { id: profileId, ...profileUpdateFromPatch(patch) };
        const { data, error } = await supabase
          .from('profiles')
          .upsert(row, { onConflict: 'id' })
          .select('*')
          .single();
        if (error) {
          onAuthError(error);
          return { success: false, error: new Error(error.message) };
        }
        return { success: true, data: profileFromRow(data) };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async getHousehold() {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        return householdApi.loadHousehold(supabase, fetchAllRows);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async createHousehold(name: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const reload = () => householdApi.loadHousehold(supabase, fetchAllRows);
        return householdApi.createHousehold(supabase, name, reload);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async updateHouseholdName(name: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const reload = () => householdApi.loadHousehold(supabase, fetchAllRows);
        return householdApi.updateHouseholdName(supabase, name, reload);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async updateSharedCategories(categoryIds: string[]) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const reload = () => householdApi.loadHousehold(supabase, fetchAllRows);
        return householdApi.updateSharedCategories(
          supabase,
          categoryIds,
          reload
        );
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async inviteByEmail(email: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const reload = () => householdApi.loadHousehold(supabase, fetchAllRows);
        return householdApi.inviteByEmail(supabase, email, reload);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async revokeInvite(inviteId: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const reload = () => householdApi.loadHousehold(supabase, fetchAllRows);
        return householdApi.revokeInvite(supabase, inviteId, reload);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async removeMember(memberUserId: string) {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        const reload = () => householdApi.loadHousehold(supabase, fetchAllRows);
        return householdApi.removeMember(supabase, memberUserId, reload);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async leaveHousehold() {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        return householdApi.leaveHousehold(supabase);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async acceptPendingInvites() {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        return householdApi.acceptPendingInvites(supabase);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    async listFamilyCategoryTotals() {
      if (!isOnline()) return failOffline();
      try {
        const { supabase } = await ensureAuth();
        return householdApi.listFamilyCategoryTotals(supabase);
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },
  };
}
