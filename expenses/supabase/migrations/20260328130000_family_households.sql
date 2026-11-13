-- Family / household accounts: shared expense categories + email invites

create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Family',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- v1: one household membership per user
create unique index if not exists household_members_user_uidx
  on public.household_members (user_id);

create table if not exists public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  email citext not null,
  invited_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create unique index if not exists household_invites_pending_email_uidx
  on public.household_invites (household_id, email)
  where status = 'pending';

create table if not exists public.household_shared_categories (
  household_id uuid not null references public.households (id) on delete cascade,
  category_id text not null,
  primary key (household_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer)
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.household_role(hid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.role
  from public.household_members m
  where m.household_id = hid
    and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_household_manager(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.household_role(hid) in ('owner', 'admin'), false);
$$;

-- Accept pending invites for the current user's email
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

  -- Already in a household: mark matching invites accepted without joining another
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

    v_accepted := v_accepted + 1;
  end loop;

  -- Expire other pending invites for this email (one household v1)
  update public.household_invites i
  set status = 'expired'
  where i.status = 'pending'
    and lower(i.email::text) = v_email;

  return jsonb_build_object('accepted', v_accepted);
end;
$$;

revoke all on function public.accept_pending_household_invites() from public;
grant execute on function public.accept_pending_household_invites() to authenticated;

grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.household_invites to authenticated;
grant select, insert, update, delete on public.household_shared_categories to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: households
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;

create policy "households_select_member"
  on public.households for select
  using (public.is_household_member(id));

create policy "households_insert_authenticated"
  on public.households for insert
  with check (auth.uid() = created_by);

create policy "households_update_manager"
  on public.households for update
  using (public.is_household_manager(id))
  with check (public.is_household_manager(id));

create policy "households_delete_owner"
  on public.households for delete
  using (public.household_role(id) = 'owner');

-- ---------------------------------------------------------------------------
-- RLS: household_members
-- ---------------------------------------------------------------------------

alter table public.household_members enable row level security;

create policy "members_select_same_household"
  on public.household_members for select
  using (public.is_household_member(household_id));

create policy "members_insert_manager_or_self_owner_bootstrap"
  on public.household_members for insert
  with check (
    (
      public.is_household_manager(household_id)
      and role in ('admin', 'member')
    )
    or (
      -- creator bootstraps as owner when creating household
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1 from public.households h
        where h.id = household_id and h.created_by = auth.uid()
      )
    )
  );

create policy "members_delete_manager_or_self"
  on public.household_members for delete
  using (
    (
      public.is_household_manager(household_id)
      and role <> 'owner'
      and user_id <> auth.uid()
    )
    or (
      -- leave household (non-owner)
      user_id = auth.uid()
      and role <> 'owner'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: household_invites
-- ---------------------------------------------------------------------------

alter table public.household_invites enable row level security;

create policy "invites_select_manager_or_invitee"
  on public.household_invites for select
  using (
    public.is_household_manager(household_id)
    or lower(email::text) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "invites_insert_manager"
  on public.household_invites for insert
  with check (
    public.is_household_manager(household_id)
    and invited_by = auth.uid()
  );

create policy "invites_update_manager"
  on public.household_invites for update
  using (public.is_household_manager(household_id))
  with check (public.is_household_manager(household_id));

-- ---------------------------------------------------------------------------
-- RLS: household_shared_categories
-- ---------------------------------------------------------------------------

alter table public.household_shared_categories enable row level security;

create policy "shared_cats_select_member"
  on public.household_shared_categories for select
  using (public.is_household_member(household_id));

create policy "shared_cats_insert_manager"
  on public.household_shared_categories for insert
  with check (public.is_household_manager(household_id));

create policy "shared_cats_delete_manager"
  on public.household_shared_categories for delete
  using (public.is_household_manager(household_id));

-- Partner expenses are never selectable via RLS.
-- Family budget uses public.family_shared_category_totals() (aggregates only).
-- See 20260328132000_family_aggregates_only.sql.
