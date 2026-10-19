-- Only an admin sees every profile.
-- Everyone else sees and edits a profile only when they are checked for it.

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

drop policy if exists profiles_editor_select on public.profiles;

drop policy if exists profiles_editor_update on public.profiles;

create policy profiles_assigned_update
  on public.profiles
  for update
  to authenticated
  using (public.has_profile_access(id))
  with check (public.has_profile_access(id));
