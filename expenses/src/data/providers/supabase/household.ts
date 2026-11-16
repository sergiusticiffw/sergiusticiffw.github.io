import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  FamilyCategoryMemberTotal,
  FamilyCategoryTotal,
  Household,
  HouseholdActivityItem,
  HouseholdCategoryGoal,
  HouseholdInvite,
  HouseholdMember,
  HouseholdRole,
  ProviderResult,
} from '../../types';

const mapAggregateRows = (
  rows: Array<{
    category_id: string;
    month: string;
    total: number | string;
  }>
): FamilyCategoryTotal[] =>
  rows.map((row) => ({
    category_id: String(row.category_id),
    month: String(row.month),
    total: Number(row.total) || 0,
  }));

const mapMemberAggregateRows = (
  rows: Array<{
    category_id: string;
    month: string;
    user_id: string;
    total: number | string;
  }>
): FamilyCategoryMemberTotal[] =>
  rows
    .map((row) => ({
      category_id: String(row.category_id),
      month: String(row.month),
      user_id: String(row.user_id),
      total: Number(row.total) || 0,
    }))
    .filter((row) => row.total > 0 && row.month.length === 7);

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
    goalsRes,
    activityRes,
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
    supabase
      .from('household_category_goals')
      .select('category_id, monthly_limit, updated_at')
      .eq('household_id', hid),
    supabase
      .from('household_activity')
      .select('id, event_type, actor_id, payload, created_at')
      .eq('household_id', hid)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  // Goals/activity tables may be missing until hardening migration is applied.
  const goals = goalsRes.error ? null : goalsRes.data;
  const activity = activityRes.error ? null : activityRes.data;

  // Fallback if RPC not migrated yet.
  let memberRows: Array<{
    user_id: string;
    role: string;
    joined_at?: string;
    email?: string | null;
    display_name?: string | null;
  }> = Array.isArray(membersRpc) ? membersRpc : [];
  if (membersRpcErr || !memberRows.length) {
    let membersQuery = await supabase
      .from('household_members')
      .select('user_id, role, joined_at, display_name')
      .eq('household_id', hid);
    if (membersQuery.error) {
      membersQuery = await supabase
        .from('household_members')
        .select('user_id, role, joined_at')
        .eq('household_id', hid);
    }
    memberRows = (membersQuery.data || []).map((m) => ({
      user_id: String(m.user_id),
      role: String(m.role),
      joined_at: m.joined_at,
      email: null,
      display_name: (m as { display_name?: string }).display_name
        ? String((m as { display_name?: string }).display_name)
        : null,
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
        display_name: m.display_name
          ? String(m.display_name).trim()
          : undefined,
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
    goals: (goals || []).map(
      (g): HouseholdCategoryGoal => ({
        category_id: String(g.category_id),
        monthly_limit: Number(g.monthly_limit) || 0,
        updated_at: g.updated_at,
      })
    ),
    activity: (activity || []).map(
      (a): HouseholdActivityItem => ({
        id: String(a.id),
        event_type: String(a.event_type),
        actor_id: a.actor_id ? String(a.actor_id) : null,
        payload: (a.payload as Record<string, unknown>) || {},
        created_at: String(a.created_at),
      })
    ),
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
  const unique = [...new Set(categoryIds.map(String).filter(Boolean))];
  const { error: rpcErr } = await supabase.rpc(
    'replace_household_shared_categories',
    { p_category_ids: unique }
  );

  // Fallback for environments that have not applied the hardening migration yet.
  if (rpcErr) {
    const hid = current.data.id;
    const { error: delErr } = await supabase
      .from('household_shared_categories')
      .delete()
      .eq('household_id', hid);
    if (delErr) return { success: false, error: new Error(delErr.message) };

    if (unique.length) {
      const { error: insErr } = await supabase
        .from('household_shared_categories')
        .insert(
          unique.map((category_id) => ({ household_id: hid, category_id }))
        );
      if (insErr) return { success: false, error: new Error(insErr.message) };
    }
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
  const hid = current.data.id;
  await supabase.rpc('log_household_activity', {
    p_household_id: hid,
    p_event_type: 'member_removed',
    p_payload: { user_id: userId },
  });
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('household_id', hid)
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
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', uid)
    .maybeSingle();
  const hid = membership?.household_id
    ? String(membership.household_id)
    : null;
  if (hid) {
    await supabase.rpc('log_household_activity', {
      p_household_id: hid,
      p_event_type: 'member_left',
      p_payload: { user_id: uid },
    });
  }
  const { error } = await supabase
    .from('household_members')
    .delete()
    .eq('user_id', uid);
  if (error) return { success: false, error: new Error(error.message) };
  return { success: true };
};

export const transferOwnership = async (
  supabase: SupabaseClient,
  newOwnerUserId: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const { error } = await supabase.rpc('transfer_household_ownership', {
    p_new_owner: newOwnerUserId,
  });
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const deleteHousehold = async (
  supabase: SupabaseClient
): Promise<ProviderResult<void>> => {
  const { error } = await supabase.rpc('delete_my_household');
  if (error) return { success: false, error: new Error(error.message) };
  return { success: true };
};

export const setMemberRole = async (
  supabase: SupabaseClient,
  userId: string,
  role: Extract<HouseholdRole, 'admin' | 'member'>,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const { error } = await supabase.rpc('set_household_member_role', {
    p_user_id: userId,
    p_role: role,
  });
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const setMyDisplayName = async (
  supabase: SupabaseClient,
  name: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const { error } = await supabase.rpc('set_my_household_display_name', {
    p_name: name,
  });
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const upsertCategoryGoal = async (
  supabase: SupabaseClient,
  categoryId: string,
  monthlyLimit: number,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const { error } = await supabase.rpc('upsert_household_category_goal', {
    p_category_id: categoryId,
    p_monthly_limit: monthlyLimit,
  });
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const deleteCategoryGoal = async (
  supabase: SupabaseClient,
  categoryId: string,
  reload: () => Promise<ProviderResult<Household | null>>
): Promise<ProviderResult<Household>> => {
  const { error } = await supabase.rpc('delete_household_category_goal', {
    p_category_id: categoryId,
  });
  if (error) return { success: false, error: new Error(error.message) };
  const loaded = await reload();
  if (!loaded.success || !loaded.data) {
    return { success: false, error: loaded.error || new Error('Reload failed') };
  }
  return { success: true, data: loaded.data };
};

export const listHouseholdActivity = async (
  supabase: SupabaseClient
): Promise<ProviderResult<HouseholdActivityItem[]>> => {
  const hid = (
    await supabase.rpc('my_household_id')
  ).data as string | null;
  if (!hid) return { success: true, data: [] };
  const { data, error } = await supabase
    .from('household_activity')
    .select('id, event_type, actor_id, payload, created_at')
    .eq('household_id', hid)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) return { success: false, error: new Error(error.message) };
  return {
    success: true,
    data: (data || []).map(
      (a): HouseholdActivityItem => ({
        id: String(a.id),
        event_type: String(a.event_type),
        actor_id: a.actor_id ? String(a.actor_id) : null,
        payload: (a.payload as Record<string, unknown>) || {},
        created_at: String(a.created_at),
      })
    ),
  };
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
  return {
    success: true,
    data: mapAggregateRows(
      (data || []) as Array<{
        category_id: string;
        month: string;
        total: number | string;
      }>
    ),
  };
};

export const listFamilyCategoryMemberTotals = async (
  supabase: SupabaseClient
): Promise<ProviderResult<FamilyCategoryMemberTotal[]>> => {
  const { data, error } = await supabase.rpc(
    'family_shared_category_member_totals'
  );
  if (error) return { success: false, error: new Error(error.message) };
  return {
    success: true,
    data: mapMemberAggregateRows(
      (data || []) as Array<{
        category_id: string;
        month: string;
        user_id: string;
        total: number | string;
      }>
    ),
  };
};

export const listFamilyIncomeTotals = async (
  supabase: SupabaseClient
): Promise<ProviderResult<FamilyCategoryTotal[]>> => {
  const { data, error } = await supabase.rpc('family_shared_income_totals');
  if (error) return { success: false, error: new Error(error.message) };
  return {
    success: true,
    data: mapAggregateRows(
      (data || []) as Array<{
        category_id: string;
        month: string;
        total: number | string;
      }>
    ),
  };
};

export const listFamilyIncomeMemberTotals = async (
  supabase: SupabaseClient
): Promise<ProviderResult<FamilyCategoryMemberTotal[]>> => {
  const { data, error } = await supabase.rpc(
    'family_shared_income_member_totals'
  );
  if (error) return { success: false, error: new Error(error.message) };
  return {
    success: true,
    data: mapMemberAggregateRows(
      (data || []) as Array<{
        category_id: string;
        month: string;
        user_id: string;
        total: number | string;
      }>
    ),
  };
};
