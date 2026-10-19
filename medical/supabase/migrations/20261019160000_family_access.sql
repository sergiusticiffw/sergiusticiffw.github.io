-- Family members can read the shared dosar.
-- Editors can add and change records. Only an admin invites people,
-- connects Google Drive, or deletes a profile.

alter table public.family_members
  add column email text;

alter table public.family_members
  add constraint family_members_email_length
  check (email is null or char_length(email) between 3 and 320);

update public.family_members as member
set email = lower(users.email)
from auth.users as users
where member.user_id = users.id
  and users.email is not null
  and member.email is null;

create table public.family_invites (
  family_id uuid not null references public.families (id) on delete cascade,
  email text not null check (char_length(email) between 3 and 320),
  role text not null check (role in ('admin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (family_id, email)
);

alter table public.family_invites enable row level security;
revoke all on table public.family_invites from anon, public;
grant select, delete on table public.family_invites to authenticated;

create or replace function public.is_family_member(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_family_editor(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = auth.uid()
      and role in ('admin', 'editor')
  );
$$;

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
      and public.is_family_member(profile.family_id)
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
      and public.is_family_editor(profile.family_id)
  );
$$;

revoke all on function public.is_family_member(uuid) from public, anon;
revoke all on function public.is_family_editor(uuid) from public, anon;
revoke all on function public.is_profile_member(uuid) from public, anon;
revoke all on function public.is_profile_editor(uuid) from public, anon;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.is_family_editor(uuid) to authenticated;
grant execute on function public.is_profile_member(uuid) to authenticated;
grant execute on function public.is_profile_editor(uuid) to authenticated;

create policy families_member_select
  on public.families
  for select
  to authenticated
  using (public.is_family_member(id));

create policy family_members_member_select
  on public.family_members
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_family_member(family_id));

create policy family_invites_admin_select
  on public.family_invites
  for select
  to authenticated
  using (public.is_family_admin(family_id));

create policy family_invites_admin_delete
  on public.family_invites
  for delete
  to authenticated
  using (public.is_family_admin(family_id));

create policy profiles_member_select
  on public.profiles
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy profiles_editor_update
  on public.profiles
  for update
  to authenticated
  using (public.is_family_editor(family_id))
  with check (public.is_family_editor(family_id));

create policy consultations_member_select
  on public.consultations
  for select
  to authenticated
  using (public.is_profile_member(profile_id));

create policy consultations_editor_insert
  on public.consultations
  for insert
  to authenticated
  with check (public.is_profile_editor(profile_id));

create policy consultations_editor_update
  on public.consultations
  for update
  to authenticated
  using (public.is_profile_editor(profile_id))
  with check (public.is_profile_editor(profile_id));

create policy consultations_editor_delete
  on public.consultations
  for delete
  to authenticated
  using (public.is_profile_editor(profile_id));

create policy lab_tests_member_select
  on public.lab_tests
  for select
  to authenticated
  using (public.is_profile_member(profile_id));

create policy lab_tests_editor_insert
  on public.lab_tests
  for insert
  to authenticated
  with check (public.is_profile_editor(profile_id));

create policy lab_tests_editor_update
  on public.lab_tests
  for update
  to authenticated
  using (public.is_profile_editor(profile_id))
  with check (public.is_profile_editor(profile_id));

create policy lab_tests_editor_delete
  on public.lab_tests
  for delete
  to authenticated
  using (public.is_profile_editor(profile_id));

create policy medical_documents_member_select
  on public.medical_documents
  for select
  to authenticated
  using (public.is_profile_member(profile_id));

create policy medical_documents_editor_insert
  on public.medical_documents
  for insert
  to authenticated
  with check (public.is_profile_editor(profile_id));

create policy medical_documents_editor_update
  on public.medical_documents
  for update
  to authenticated
  using (public.is_profile_editor(profile_id))
  with check (public.is_profile_editor(profile_id));

create policy medical_documents_editor_delete
  on public.medical_documents
  for delete
  to authenticated
  using (public.is_profile_editor(profile_id));

create policy google_drive_connections_member_select
  on public.google_drive_connections
  for select
  to authenticated
  using (public.is_family_member(family_id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_family uuid;
  invited_role text;
  new_family_id uuid;
begin
  select family_id, role
  into invited_family, invited_role
  from public.family_invites
  where email = lower(new.email)
  order by created_at
  limit 1;

  if invited_family is not null then
    insert into public.family_members (family_id, user_id, role, email)
    values (invited_family, new.id, invited_role, lower(new.email));
    delete from public.family_invites where email = lower(new.email);
    return new;
  end if;

  insert into public.families (name)
  values ('Familia mea')
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, role, email)
  values (new_family_id, new.id, 'admin', lower(new.email));

  return new;
end;
$$;

create or replace function public.invite_family_member(
  member_email text,
  member_role text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  fid uuid;
  target uuid;
  normalized text := lower(btrim(member_email));
begin
  if caller is null or member_role not in ('admin', 'editor', 'viewer') then
    return 'invalid';
  end if;
  if normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return 'invalid';
  end if;

  select family_id into fid
  from public.family_members
  where user_id = caller
    and role = 'admin'
  limit 1;
  if fid is null then
    return 'forbidden';
  end if;

  select id into target
  from auth.users
  where lower(email) = normalized
  limit 1;

  if target = caller then
    return 'self';
  end if;

  if target is null then
    insert into public.family_invites (family_id, email, role)
    values (fid, normalized, member_role)
    on conflict (family_id, email) do update set role = excluded.role;
    return 'invited';
  end if;

  if exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = target
  ) then
    update public.family_members
    set role = member_role,
        email = normalized
    where family_id = fid
      and user_id = target;
    return 'updated';
  end if;

  if exists (
    select 1
    from public.family_members as member
    where member.user_id = target
      and (
        (
          select count(*)
          from public.family_members as sibling
          where sibling.family_id = member.family_id
        ) > 1
        or exists (
          select 1
          from public.profiles as profile
          where profile.family_id = member.family_id
        )
      )
  ) then
    return 'busy';
  end if;

  delete from public.families
  where id in (
    select family_id
    from public.family_members
    where user_id = target
  );

  insert into public.family_members (family_id, user_id, role, email)
  values (fid, target, member_role, normalized);
  delete from public.family_invites where email = normalized;
  return 'added';
end;
$$;

create or replace function public.set_family_member_role(
  member_id uuid,
  member_role text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  fid uuid;
  admin_count integer;
begin
  if caller is null or member_role not in ('admin', 'editor', 'viewer') then
    return 'invalid';
  end if;

  select family_id into fid
  from public.family_members
  where user_id = caller
    and role = 'admin'
  limit 1;
  if fid is null then
    return 'forbidden';
  end if;

  if not exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = member_id
  ) then
    return 'missing';
  end if;

  select count(*) into admin_count
  from public.family_members
  where family_id = fid
    and role = 'admin';

  if member_role <> 'admin'
    and admin_count = 1
    and exists (
      select 1
      from public.family_members
      where family_id = fid
        and user_id = member_id
        and role = 'admin'
    ) then
    return 'last_admin';
  end if;

  update public.family_members
  set role = member_role
  where family_id = fid
    and user_id = member_id;
  return 'updated';
end;
$$;

create or replace function public.remove_family_member(member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  fid uuid;
  admin_count integer;
begin
  if caller is null then
    return 'forbidden';
  end if;

  select family_id into fid
  from public.family_members
  where user_id = caller
    and role = 'admin'
  limit 1;
  if fid is null then
    return 'forbidden';
  end if;

  select count(*) into admin_count
  from public.family_members
  where family_id = fid
    and role = 'admin';

  if admin_count = 1 and exists (
    select 1
    from public.family_members
    where family_id = fid
      and user_id = member_id
      and role = 'admin'
  ) then
    return 'last_admin';
  end if;

  delete from public.family_members
  where family_id = fid
    and user_id = member_id;
  return 'removed';
end;
$$;

revoke all on function public.invite_family_member(text, text) from public, anon;
revoke all on function public.set_family_member_role(uuid, text) from public, anon;
revoke all on function public.remove_family_member(uuid) from public, anon;
grant execute on function public.invite_family_member(text, text) to authenticated;
grant execute on function public.set_family_member_role(uuid, text) to authenticated;
grant execute on function public.remove_family_member(uuid) to authenticated;
