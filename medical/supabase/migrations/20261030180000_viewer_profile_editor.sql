-- Viewers with a profile checkbox may read, but only editors/admins may write.
-- Restores is_profile_editor semantics diluted in checked_profile_access.

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
  select exists (
    select 1
    from public.profiles as profile
    where profile.id = pid
      and (
        public.is_family_admin(profile.family_id)
        or (
          public.has_profile_access(profile.id)
          and public.is_family_editor(profile.family_id)
        )
      )
  );
$$;

drop policy if exists profiles_assigned_update on public.profiles;

create policy profiles_assigned_update
  on public.profiles
  for update
  to authenticated
  using (public.is_profile_editor(id))
  with check (public.is_profile_editor(id));
