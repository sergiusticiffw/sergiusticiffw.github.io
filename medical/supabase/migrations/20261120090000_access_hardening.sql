-- Access hardening (audit findings V1, P1, P2).
--
-- V1: removing a family member left their profile_access grants behind, and
--     has_profile_access() trusted those grants without checking membership,
--     so a removed user could still read every profile they had been assigned.
-- P1: editors could change profiles.family_id and move a person to another
--     family.
-- P2: record_id / source_document_id were not checked to belong to the same
--     profile as the row pointing at them.
--
-- Not changed on purpose: google_drive_connections SELECT and the ai_usage_*
-- write policies. The app reads the encrypted Drive token and writes usage
-- counters with the signed-in user's client (no service-role key), so tightening
-- them here would break uploads for editors. Revisit if a server-only key is
-- ever introduced.

-- V1 -----------------------------------------------------------------------

create or replace function public.has_profile_access(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profile_access as access
    join public.profiles as profile
      on profile.id = access.profile_id
    join public.family_members as member
      on member.family_id = profile.family_id
     and member.user_id = access.user_id
    where access.profile_id = pid
      and access.user_id = auth.uid()
  );
$$;

revoke all on function public.has_profile_access(uuid) from public, anon;
grant execute on function public.has_profile_access(uuid) to authenticated;

-- Clean up grants that already outlived their membership.
delete from public.profile_access as access
where not exists (
  select 1
  from public.profiles as profile
  join public.family_members as member
    on member.family_id = profile.family_id
   and member.user_id = access.user_id
  where profile.id = access.profile_id
);

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

  delete from public.profile_access
  where user_id = member_id
    and profile_id in (
      select id from public.profiles where family_id = fid
    );

  delete from public.family_members
  where family_id = fid
    and user_id = member_id;
  return 'removed';
end;
$$;

revoke all on function public.remove_family_member(uuid) from public, anon;
grant execute on function public.remove_family_member(uuid) to authenticated;

-- P1: a person never changes family -----------------------------------------

create or replace function public.profiles_family_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.family_id is distinct from old.family_id then
    raise exception 'profiles.family_id cannot be changed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_family_immutable on public.profiles;
create trigger profiles_family_immutable
  before update on public.profiles
  for each row
  execute function public.profiles_family_immutable();

-- P2: linked rows must belong to the same profile ---------------------------

create or replace function public.medical_documents_record_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.record_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.record_id is not distinct from old.record_id then
    return new;
  end if;
  if not exists (
    select 1
    from public.medical_documents as primary_document
    where primary_document.id = new.record_id
      and primary_document.profile_id = new.profile_id
      and primary_document.record_id is null
  ) then
    raise exception 'record_id must be a main document of the same profile'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists medical_documents_record_guard on public.medical_documents;
create trigger medical_documents_record_guard
  before insert or update on public.medical_documents
  for each row
  execute function public.medical_documents_record_guard();

create or replace function public.source_document_same_profile_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_id uuid := nullif(to_jsonb(new) ->> 'source_document_id', '')::uuid;
  previous_id uuid;
begin
  if source_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    previous_id := nullif(to_jsonb(old) ->> 'source_document_id', '')::uuid;
    if source_id is not distinct from previous_id then
      return new;
    end if;
  end if;
  if not exists (
    select 1
    from public.medical_documents as source_document
    where source_document.id = source_id
      and source_document.profile_id = new.profile_id
  ) then
    raise exception 'source_document_id must belong to the same profile'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_source_guard on public.consultations;
create trigger consultations_source_guard
  before insert or update on public.consultations
  for each row
  execute function public.source_document_same_profile_guard();

drop trigger if exists lab_tests_source_guard on public.lab_tests;
create trigger lab_tests_source_guard
  before insert or update on public.lab_tests
  for each row
  execute function public.source_document_same_profile_guard();

drop trigger if exists medical_insurances_source_guard on public.medical_insurances;
create trigger medical_insurances_source_guard
  before insert or update on public.medical_insurances
  for each row
  execute function public.source_document_same_profile_guard();

drop trigger if exists profile_identity_docs_source_guard on public.profile_identity_docs;
create trigger profile_identity_docs_source_guard
  before insert or update on public.profile_identity_docs
  for each row
  execute function public.source_document_same_profile_guard();
