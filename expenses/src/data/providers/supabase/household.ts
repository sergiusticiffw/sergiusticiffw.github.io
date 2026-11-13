import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FamilyCategoryTotal,
  Household,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
  ProviderResult,
} from '../../types';

const unsupported = <T,>(msg = 'Households require Supabase'): ProviderResult<T> => ({
  success: false,
  error: new Error(msg),
});

export const loadHousehold = async (
  supabase: SupabaseClient,
  fetchAllRows: <T>(
    build: (
      from: number,
      to: number
    ) => PromiseLike<{
      data: T[] | null;
      error: { message: string; code?: string } | null;
    }>
  ) => Promise<{ data: T[]; error: { message: string; code?: string } | null }>
): Promise<ProviderResult<Household | null>> => {
  const userId = (await supabase.auth.getUser()).data.user?.id;
  // Empty string is not a valid UUID — PostgREST returns 22P02.
  if (!userId) return { success: true, data: null };

  const { data: membership, error: memErr } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', userId)
    .maybeSingle();

  if (memErr) return { success: false, error: new Error(memErr.message) };
  if (!membership) return { success: true, data: null };

  const hid = membership.household_id as string;
  const myRole = membership.role as HouseholdRole;

  const { data: house, error: hErr } = await supabase
    .from('households')
    .select('*')
    .eq('id', hid)
    .single();
  if (hErr || !house) {
    return {
      success: false,
      error: new Error(hErr?.message || 'Household not found'),
    };
  }

  const [
    { data: membersRpc, error: membersRpcErr },
    { data: invites },
    { data: cats },
  ] = await Promise.all([
    supabase.rpc('household_members_with_email', {
      p_household_id: hid,
    }),
    supabase
      .from('household_invites')
      .select('id, email, status, invited_by, created_at, expires_at')
      .eq('household_id', hid)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
    supabase
      .from('household_shared_categories')
      .select('category_id')
      .eq('household_id', hid),
  ]);

  // Fallback if RPC not migrated yet.
  let memberRows: Array<{
    user_id: string;
    role: string;
    joined_at?: string;
    email?: string | null;
  }> = Array.isArray(membersRpc) ? membersRpc : [];
  if (membersRpcErr || !memberRows.length) {
    const { data: members } = await supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('household_id', hid);
    memberRows = (members || []).map((m) => ({
      user_id: String(m.user_id),
      role: String(m.role),
      joined_at: m.joined_at,
      email: null,
    }));
  }

  const household: Household = {
    id: String(house.id),
    name: house.name || 'Family',
    created_by: String(house.created_by),
    my_role: myRole,
    members: memberRows.map(
      (m): HouseholdMember => ({
        user_id: String(m.user_id),
        role: m.role as HouseholdRole,
        joined_at: m.joined_at,
        email: m.email ? String(m.email).trim().toLowerCase() : undefined,
      })
    ),
    invites: (invites || []).map(
      (i): HouseholdInvite => ({
        id: String(i.id),
        email: String(i.email),
        status: i.status,
        invited_by: String(i.invited_by),
        created_at: i.created_at,
        expires_at: i.expires_at,
      })
    ),
    shared_categories: (cats || []).map((c) => String(c.category_id)),
  };

  return { success: true, data: household };
};

export const createHousehold = async (
  supabase: SupabaseClient,
  name: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return unsupported('Not signed in');

  const existing = await reload();
  if (existing.success && existing.data) {
    return {
      success: false,
      error: new Error('You already belong to a household'),
    };
  }

  // Security-definer RPC: avoids RLS chicken/egg on first household insert.
  const { error } = await supabase.rpc('create_household', {
    p_name: name.trim() || 'Family',
  });
  if (error) {
    return {
      success: false,
      error: new Error(error.message || 'Could not create household'),
    };
  }

  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return {
      success: false,
      error: loaded.error || new Error('Household created but failed to load'),
    };
  }
  return { success: true, data: loaded.data };
};

export const updateHouseholdName = async (
  supabase: SupabaseClient,
  name: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const current = await reload();
  if (!current.success || !current.data) {
    return {
      success: false,
      error: current.error || new Error('No household'),
    };
  }
  const { error } = await supabase
    .from('households')
    .update({ name: name.trim() || 'Family', updated_at: new Date().toISOString() })
    .eq('id', current.data.id);
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const updateSharedCategories = async (
  supabase: SupabaseClient,
  categoryIds: string[],
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const current = await reload();
  if (!current.success || !current.data) {
    return {
      success: false,
      error: current.error || new Error('No household'),
    };
  }
  const hid = current.data.id;
  const { error: delErr } = await supabase
    .from('household_shared_categories')
    .delete()
    .eq('household_id', hid);
  if (delErr) return { success: false, error: new Error(delErr.message) };

  const unique = [...new Set(categoryIds.map(String).filter(Boolean))];
  if (unique.length) {
    const { error: insErr } = await supabase
      .from('household_shared_categories')
      .insert(unique.map((category_id) => ({ household_id: hid, category_id })));
    if (insErr) return { success: false, error: new Error(insErr.message) };
  }

  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const inviteByEmail = async (
  supabase: SupabaseClient,
  email: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const current = await reload();
  if (!current.success || !current.data) {
    return {
      success: false,
      error: current.error || new Error('No household'),
    };
  }
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return unsupported('Not signed in');

  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) {
    return { success: false, error: new Error('Enter a valid email') };
  }

  const { error } = await supabase.from('household_invites').insert({
    household_id: current.data.id,
    email: normalized,
    invited_by: uid,
    status: 'pending',
  });
  if (error) return { success: false, error: new Error(error.message) };

  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const revokeInvite = async (
  supabase: SupabaseClient,
  inviteId: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const { error } = await supabase
    .from('household_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId);
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const removeMember = async (
  supabase: SupabaseClient,
  userId: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const current = await reload();
  if (!current.success || !current.data) {
    return {
      success: false,
      error: current.error || new Error('No household'),
    };
  }
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', current.data.id)
    .eq('user_id', userId);
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const leaveHousehold = async (
  supabase: SupabaseClient
): Promise<ProviderResult<void>> => {
  const uid = (await supabase.auth.getUser()).data.user?.id;
  if (!uid) return unsupported('Not signed in');
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('user_id', uid);
  if (error) return { success: false, error: new Error(error.message) };
  return { success: true };
};

export const acceptPendingInvites = async (
  supabase: SupabaseClient
): Promise<
  ProviderResult<{ accepted: number; already_member?: boolean }>
> => {
  const { data, error } = await supabase.rpc('accept_pending_household_invites');
  if (error) return { success: false, error: new Error(error.message) };
  const accepted = Number((data as any)?.accepted ?? 0);
  return {
    success: true,
    data: {
      accepted,
      already_member: !!(data as any)?.already_member,
    },
  };
};

export const listFamilyCategoryTotals = async (
  supabase: SupabaseClient
): Promise<ProviderResult<FamilyCategoryTotal[]>> => {
  const { data, error } = await supabase.rpc('family_shared_category_totals');
  if (error) return { success: false, error: new Error(error.message) };

  const rows = (data || []) as Array<{
    category_id: string;
    month: string;
    total: number | string;
  }>;

  return {
    success: true,
    data: rows.map((row) => ({
      category_id: String(row.category_id),
      month: String(row.month),
      total: Number(row.total) || 0,
    })),
  };
};
