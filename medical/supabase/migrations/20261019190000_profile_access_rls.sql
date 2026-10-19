-- Reading profiles checked profile_access, and reading profile_access checked
-- profiles. Postgres stops that cycle and the profile list fails.
-- Run this if 20261019180000_profile_access.sql was already applied.

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

drop policy if exists profile_access_select on public.profile_access;
create policy profile_access_select
  on public.profile_access
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_profile_access_admin(profile_id)
  );

drop policy if exists profiles_assigned_select on public.profiles;
create policy profiles_assigned_select
  on public.profiles
  for select
  to authenticated
  using (public.has_profile_access(id));
