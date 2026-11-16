-- Family hardening: ownership transfer/delete, roles, atomic shared cats,
-- display names, category goals, activity feed, income aggregates.

-- ---------------------------------------------------------------------------
-- Schema additions
-- ---------------------------------------------------------------------------

alter table public.household_members
  add column if not exists display_name text;

create table if not exists public.household_category_goals (
  household_id uuid not null references public.households (id) on delete cascade,
  category_id text not null,
  monthly_limit numeric not null check (monthly_limit > 0),
  updated_at timestamptz not null default now(),
  primary key (household_id, category_id)
);

create table if not exists public.household_activity (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists household_activity_house_created_idx
  on public.household_activity (household_id, created_at desc);

grant select, insert, update, delete on public.household_category_goals to authenticated;
grant select, insert on public.household_activity to authenticated;

alter table public.household_category_goals enable row level security;
alter table public.household_activity enable row level security;

drop policy if exists "goals_select_member" on public.household_category_goals;
create policy "goals_select_member"
  on public.household_category_goals for select
  using (public.is_household_member(household_id));

drop policy if exists "goals_write_manager" on public.household_category_goals;
create policy "goals_write_manager"
  on public.household_category_goals for all
  using (public.is_household_manager(household_id))
  with check (public.is_household_manager(household_id));

drop policy if exists "activity_select_member" on public.household_activity;
create policy "activity_select_member"
  on public.household_activity for select
  using (public.is_household_member(household_id));

drop policy if exists "activity_insert_member" on public.household_activity;
create policy "activity_insert_member"
  on public.household_activity for insert
  with check (
    public.is_household_member(household_id)
    and (actor_id is null or actor_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Activity helper
-- ---------------------------------------------------------------------------

create or replace function public.log_household_activity(
  p_household_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_household_id is null or coalesce(trim(p_event_type), '') = '' then
    return;
  end if;
  insert into public.household_activity (household_id, actor_id, event_type, payload)
  values (p_household_id, auth.uid(), p_event_type, coalesce(p_payload, '{}'::jsonb));
end;
$$;

revoke all on function public.log_household_activity(uuid, text, jsonb) from public;
grant execute on function public.log_household_activity(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Atomic shared categories replace
-- ---------------------------------------------------------------------------

create or replace function public.replace_household_shared_categories(
  p_category_ids text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
  v_ids text[];
begin
  if v_hid is null then
    raise exception 'No household';
  end if;
  if not public.is_household_manager(v_hid) then
    raise exception 'Not allowed';
  end if;

  select coalesce(array_agg(distinct trim(x)), '{}'::text[])
  into v_ids
  from unnest(coalesce(p_category_ids, '{}'::text[])) as x
  where trim(x) <> '';

  delete from public.household_shared_categories
  where household_id = v_hid;

  if array_length(v_ids, 1) is not null then
    insert into public.household_shared_categories (household_id, category_id)
    select v_hid, unnest(v_ids);
  end if;

  perform public.log_household_activity(
    v_hid,
    'shared_categories_updated',
    jsonb_build_object('count', coalesce(array_length(v_ids, 1), 0))
  );
end;
$$;

revoke all on function public.replace_household_shared_categories(text[]) from public;
grant execute on function public.replace_household_shared_categories(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Roles: promote / demote (owner only for admin; owner cannot demote self)
-- ---------------------------------------------------------------------------

create or replace function public.set_household_member_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
  v_my_role text;
  v_target_role text;
begin
  if v_hid is null then
    raise exception 'No household';
  end if;
  if p_user_id is null or p_role not in ('admin', 'member') then
    raise exception 'Invalid role';
  end if;

  v_my_role := public.household_role(v_hid);
  if v_my_role <> 'owner' then
    raise exception 'Only the owner can change roles';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Cannot change your own role';
  end if;

  select m.role into v_target_role
  from public.household_members m
  where m.household_id = v_hid and m.user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Member not found';
  end if;
  if v_target_role = 'owner' then
    raise exception 'Cannot change owner role this way';
  end if;

  update public.household_members
  set role = p_role
  where household_id = v_hid and user_id = p_user_id;

  perform public.log_household_activity(
    v_hid,
    'member_role_changed',
    jsonb_build_object('user_id', p_user_id, 'role', p_role)
  );
end;
$$;

revoke all on function public.set_household_member_role(uuid, text) from public;
grant execute on function public.set_household_member_role(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Display name (self)
-- ---------------------------------------------------------------------------

create or replace function public.set_my_household_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
  v_name text := nullif(trim(coalesce(p_name, '')), '');
begin
  if v_hid is null then
    raise exception 'No household';
  end if;
  update public.household_members
  set display_name = v_name
  where household_id = v_hid and user_id = auth.uid();
end;
$$;

revoke all on function public.set_my_household_display_name(text) from public;
grant execute on function public.set_my_household_display_name(text) to authenticated;

-- Update members-with-email RPC to include display_name (signature change → drop first)
drop function if exists public.household_members_with_email(uuid);

create function public.household_members_with_email(p_household_id uuid)
returns table (
  user_id uuid,
  role text,
  joined_at timestamptz,
  email text,
  display_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_household_id is null or not public.is_household_member(p_household_id) then
    raise exception 'Not a household member';
  end if;

  return query
  select
    m.user_id,
    m.role,
    m.joined_at,
    lower(coalesce(u.email, ''))::text as email,
    m.display_name
  from public.household_members m
  left join auth.users u on u.id = m.user_id
  where m.household_id = p_household_id
  order by
    case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    m.joined_at asc nulls last;
end;
$$;

revoke all on function public.household_members_with_email(uuid) from public;
grant execute on function public.household_members_with_email(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Ownership transfer + delete household
-- ---------------------------------------------------------------------------

create or replace function public.transfer_household_ownership(p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
begin
  if v_hid is null then
    raise exception 'No household';
  end if;
  if public.household_role(v_hid) <> 'owner' then
    raise exception 'Only the owner can transfer ownership';
  end if;
  if p_new_owner is null or p_new_owner = auth.uid() then
    raise exception 'Pick another member';
  end if;
  if not exists (
    select 1 from public.household_members m
    where m.household_id = v_hid and m.user_id = p_new_owner
  ) then
    raise exception 'Member not found';
  end if;

  update public.household_members
  set role = 'admin'
  where household_id = v_hid and user_id = auth.uid();

  update public.household_members
  set role = 'owner'
  where household_id = v_hid and user_id = p_new_owner;

  update public.households
  set created_by = p_new_owner, updated_at = now()
  where id = v_hid;

  perform public.log_household_activity(
    v_hid,
    'ownership_transferred',
    jsonb_build_object('new_owner', p_new_owner)
  );
end;
$$;

revoke all on function public.transfer_household_ownership(uuid) from public;
grant execute on function public.transfer_household_ownership(uuid) to authenticated;

create or replace function public.delete_my_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
begin
  if v_hid is null then
    raise exception 'No household';
  end if;
  if public.household_role(v_hid) <> 'owner' then
    raise exception 'Only the owner can delete the household';
  end if;
  delete from public.households where id = v_hid;
end;
$$;

revoke all on function public.delete_my_household() from public;
grant execute on function public.delete_my_household() to authenticated;

-- ---------------------------------------------------------------------------
-- Category goals upsert / clear
-- ---------------------------------------------------------------------------

create or replace function public.upsert_household_category_goal(
  p_category_id text,
  p_monthly_limit numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
begin
  if v_hid is null then
    raise exception 'No household';
  end if;
  if not public.is_household_manager(v_hid) then
    raise exception 'Not allowed';
  end if;
  if coalesce(trim(p_category_id), '') = '' or p_monthly_limit is null or p_monthly_limit <= 0 then
    raise exception 'Invalid goal';
  end if;

  insert into public.household_category_goals (household_id, category_id, monthly_limit, updated_at)
  values (v_hid, trim(p_category_id), p_monthly_limit, now())
  on conflict (household_id, category_id)
  do update set monthly_limit = excluded.monthly_limit, updated_at = now();

  perform public.log_household_activity(
    v_hid,
    'goal_updated',
    jsonb_build_object('category_id', trim(p_category_id), 'monthly_limit', p_monthly_limit)
  );
end;
$$;

revoke all on function public.upsert_household_category_goal(text, numeric) from public;
grant execute on function public.upsert_household_category_goal(text, numeric) to authenticated;

create or replace function public.delete_household_category_goal(p_category_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hid uuid := public.my_household_id();
begin
  if v_hid is null then
    raise exception 'No household';
  end if;
  if not public.is_household_manager(v_hid) then
    raise exception 'Not allowed';
  end if;
  delete from public.household_category_goals
  where household_id = v_hid and category_id = trim(p_category_id);

  perform public.log_household_activity(
    v_hid,
    'goal_deleted',
    jsonb_build_object('category_id', trim(p_category_id))
  );
end;
$$;

revoke all on function public.delete_household_category_goal(text) from public;
grant execute on function public.delete_household_category_goal(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Income aggregates (shared categories, type = incomes)
-- ---------------------------------------------------------------------------

create or replace function public.family_shared_income_totals()
returns table (
  category_id text,
  month text,
  total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.category::text,
    substr(t.date, 1, 7) as month,
    sum(
      case
        when trim(t.amount) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then trim(t.amount)::numeric
        when trim(t.amount) ~ '^-?[0-9]+,[0-9]+$'
          then replace(trim(t.amount), ',', '.')::numeric
        when nullif(regexp_replace(trim(t.amount), '[^0-9,.\-]', '', 'g'), '')
             is not null
          then replace(
              regexp_replace(trim(t.amount), '[^0-9,.\-]', '', 'g'),
              ',',
              '.'
            )::numeric
        else 0
      end
    ) as total
  from public.transactions t
  where public.my_household_id() is not null
    and t.user_id in (
      select m.user_id
      from public.household_members m
      where m.household_id = public.my_household_id()
    )
    and t.type = 'incomes'
    and t.category is not null
    and length(coalesce(t.date, '')) >= 7
    and exists (
      select 1
      from public.household_shared_categories sc
      where sc.household_id = public.my_household_id()
        and sc.category_id = t.category
    )
  group by t.category, substr(t.date, 1, 7);
$$;

revoke all on function public.family_shared_income_totals() from public;
grant execute on function public.family_shared_income_totals() to authenticated;

create or replace function public.family_shared_income_member_totals()
returns table (
  category_id text,
  month text,
  user_id uuid,
  total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.category::text,
    substr(t.date, 1, 7) as month,
    t.user_id,
    sum(
      case
        when trim(t.amount) ~ '^-?[0-9]+(\.[0-9]+)?$'
          then trim(t.amount)::numeric
        when trim(t.amount) ~ '^-?[0-9]+,[0-9]+$'
          then replace(trim(t.amount), ',', '.')::numeric
        when nullif(regexp_replace(trim(t.amount), '[^0-9,.\-]', '', 'g'), '')
             is not null
          then replace(
              regexp_replace(trim(t.amount), '[^0-9,.\-]', '', 'g'),
              ',',
              '.'
            )::numeric
        else 0
      end
    ) as total
  from public.transactions t
  where public.my_household_id() is not null
    and t.user_id in (
      select m.user_id
      from public.household_members m
      where m.household_id = public.my_household_id()
    )
    and t.type = 'incomes'
    and t.category is not null
    and length(coalesce(t.date, '')) >= 7
    and exists (
      select 1
      from public.household_shared_categories sc
      where sc.household_id = public.my_household_id()
        and sc.category_id = t.category
    )
  group by t.category, substr(t.date, 1, 7), t.user_id;
$$;

revoke all on function public.family_shared_income_member_totals() from public;
grant execute on function public.family_shared_income_member_totals() to authenticated;

-- Log member join from accept flow
create or replace function public.accept_pending_household_invites()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_uid uuid := auth.uid();
  v_accepted int := 0;
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));
  if v_email = '' then
    return jsonb_build_object('accepted', 0);
  end if;

  if public.my_household_id() is not null then
    update public.household_invites i
    set status = 'accepted'
    where i.status = 'pending'
      and lower(i.email::text) = v_email
      and (i.expires_at is null or i.expires_at > now());
    return jsonb_build_object('accepted', 0, 'already_member', true);
  end if;

  for r in
    select i.id, i.household_id
    from public.household_invites i
    where i.status = 'pending'
      and lower(i.email::text) = v_email
      and (i.expires_at is null or i.expires_at > now())
    order by i.created_at asc
    limit 1
  loop
    insert into public.household_members (household_id, user_id, role)
    values (r.household_id, v_uid, 'member')
    on conflict (user_id) do nothing;

    update public.household_invites
    set status = 'accepted'
    where id = r.id;

    perform public.log_household_activity(
      r.household_id,
      'member_joined',
      jsonb_build_object('user_id', v_uid)
    );

    v_accepted := v_accepted + 1;
  end loop;

  update public.household_invites i
  set status = 'expired'
  where i.status = 'pending'
    and lower(i.email::text) = v_email;

  return jsonb_build_object('accepted', v_accepted);
end;
$$;
