-- A profile can be managed by several existing family members.
-- Family admins and editors still see every profile.
-- A viewer sees and edits records only for the profiles assigned here.

create table public.profile_access (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, user_id)
);

create index profile_access_user_idx on public.profile_access (user_id);

alter table public.profile_access enable row level security;
revoke all on table public.profile_access from anon, public;
grant select on table public.profile_access to authenticated;

-- Security definer so a profile read does not re-enter profile_access RLS,
-- and an access read does not re-enter profiles RLS.
create or replace function public.has_profile_access(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_access
    where profile_id = pid
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_profile_access_admin(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = pid
      and public.is_family_admin(profile.family_id)
  );
$$;

revoke all on function public.has_profile_access(uuid) from public, anon;
revoke all on function public.is_profile_access_admin(uuid) from public, anon;
grant execute on function public.has_profile_access(uuid) to authenticated;
grant execute on function public.is_profile_access_admin(uuid) to authenticated;

create policy profile_access_select
  on public.profile_access
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_profile_access_admin(profile_id)
  );

create or replace function public.is_profile_member(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = pid
      and (
        public.is_family_admin(profile.family_id)
        or public.has_profile_access(profile.id)
      )
  );
$$;

create or replace function public.is_profile_editor(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_profile_member(pid);
$$;

create or replace function public.set_profile_access(
  pid uuid,
  member_ids uuid[]
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  fid uuid;
begin
  if caller is null then
    return 'forbidden';
  end if;

  select family_id into fid
  from public.profiles
  where id = pid;
  if fid is null or not public.is_family_admin(fid) then
    return 'forbidden';
  end if;

  if exists (
    select 1
    from unnest(coalesce(member_ids, array[]::uuid[])) as member (id)
    where not exists (
      select 1
      from public.family_members
      where family_id = fid
        and user_id = member.id
    )
  ) then
    return 'invalid';
  end if;

  delete from public.profile_access where profile_id = pid;

  insert into public.profile_access (profile_id, user_id)
  select distinct pid, member.id
  from unnest(coalesce(member_ids, array[]::uuid[])) as member (id);

  return 'saved';
end;
$$;

revoke all on function public.set_profile_access(uuid, uuid[]) from public, anon;
grant execute on function public.set_profile_access(uuid, uuid[]) to authenticated;

drop policy if exists profiles_member_select on public.profiles;
drop policy if exists profiles_editor_select on public.profiles;

create policy profiles_assigned_select
  on public.profiles
  for select
  to authenticated
  using (public.has_profile_access(id));
