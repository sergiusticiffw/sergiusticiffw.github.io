-- Personal family medical record.
-- Roles admin, editor and viewer are stored, but only admin can read or write.
-- Editor and viewer stay inactive until their policies are tested.
-- Photographs and PDFs stay in a private Google Drive folder owned by the
-- family Google account. This database stores metadata and an encrypted
-- OAuth refresh token. Plaintext Google tokens never reach the browser.
-- Do not grant the Drive folder to "anyone with the link".

create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'editor', 'viewer')),
  primary key (family_id, user_id)
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 120),
  birth_date date,
  notes text check (notes is null or char_length(notes) <= 2000),
  drive_folder_id text check (
    drive_folder_id is null
    or drive_folder_id ~ '^[A-Za-z0-9_-]{10,128}$'
  ),
  created_at timestamptz not null default now()
);

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  doctor_name text,
  clinic_name text,
  specialty text,
  consultation_date date not null,
  summary text,
  recommendations text,
  created_at timestamptz not null default now()
);

create table public.lab_tests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  test_name text not null,
  category text,
  sample_date date,
  result_value numeric,
  result_text text,
  unit text,
  reference_min numeric,
  reference_max numeric,
  reference_text text,
  laboratory text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  consultation_id uuid references public.consultations (id) on delete set null,
  lab_test_id uuid references public.lab_tests (id) on delete set null,
  drive_file_id text not null check (drive_file_id ~ '^[A-Za-z0-9_-]{10,128}$'),
  original_filename text not null check (
    char_length(original_filename) between 1 and 255
    and original_filename !~ '[\\/]'
  ),
  mime_type text not null check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  document_date date,
  category text,
  created_at timestamptz not null default now(),
  constraint medical_documents_drive_file_id_key unique (drive_file_id)
);

create table public.google_drive_connections (
  family_id uuid primary key references public.families (id) on delete cascade,
  refresh_token_ciphertext text not null,
  root_folder_id text check (
    root_folder_id is null
    or root_folder_id ~ '^[A-Za-z0-9_-]{10,128}$'
  ),
  updated_at timestamptz not null default now()
);

create index family_members_user_id_idx on public.family_members (user_id);
create index profiles_family_id_idx on public.profiles (family_id);
create index consultations_profile_date_idx
  on public.consultations (profile_id, consultation_date desc);
create index lab_tests_profile_sample_idx
  on public.lab_tests (profile_id, sample_date desc);
create index medical_documents_profile_date_idx
  on public.medical_documents (profile_id, document_date desc);

create or replace function public.is_family_admin(fid uuid)
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
      and role = 'admin'
  );
$$;

create or replace function public.is_profile_admin(pid uuid)
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

revoke all on function public.is_family_admin(uuid) from public, anon;
revoke all on function public.is_profile_admin(uuid) from public, anon;
grant execute on function public.is_family_admin(uuid) to authenticated;
grant execute on function public.is_profile_admin(uuid) to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_family_id uuid;
begin
  insert into public.families (name)
  values ('Familia mea')
  returning id into new_family_id;

  insert into public.family_members (family_id, user_id, role)
  values (new_family_id, new.id, 'admin');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

create or replace function public.medical_documents_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = new.profile_id
  ) then
    raise exception 'profile not found';
  end if;

  if new.consultation_id is not null and not exists (
    select 1
    from public.consultations as consultation
    where consultation.id = new.consultation_id
      and consultation.profile_id = new.profile_id
  ) then
    raise exception 'consultation_id does not belong to profile_id';
  end if;

  if new.lab_test_id is not null and not exists (
    select 1
    from public.lab_tests as lab_test
    where lab_test.id = new.lab_test_id
      and lab_test.profile_id = new.profile_id
  ) then
    raise exception 'lab_test_id does not belong to profile_id';
  end if;

  return new;
end;
$$;

revoke all on function public.medical_documents_guard() from public, anon, authenticated;

create trigger medical_documents_guard
  before insert or update on public.medical_documents
  for each row
  execute function public.medical_documents_guard();

alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.profiles enable row level security;
alter table public.consultations enable row level security;
alter table public.lab_tests enable row level security;
alter table public.medical_documents enable row level security;
alter table public.google_drive_connections enable row level security;

revoke all on table public.families from anon, public;
revoke all on table public.family_members from anon, public;
revoke all on table public.profiles from anon, public;
revoke all on table public.consultations from anon, public;
revoke all on table public.lab_tests from anon, public;
revoke all on table public.medical_documents from anon, public;
revoke all on table public.google_drive_connections from anon, public;

grant select, update on table public.families to authenticated;
grant select on table public.family_members to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.consultations to authenticated;
grant select, insert, update, delete on table public.lab_tests to authenticated;
grant select, insert, update, delete on table public.medical_documents to authenticated;
grant select, insert, update, delete on table public.google_drive_connections to authenticated;

create policy families_admin_select
  on public.families
  for select
  to authenticated
  using (public.is_family_admin(id));

create policy families_admin_update
  on public.families
  for update
  to authenticated
  using (public.is_family_admin(id))
  with check (public.is_family_admin(id));

create policy family_members_admin_select
  on public.family_members
  for select
  to authenticated
  using (public.is_family_admin(family_id));

create policy profiles_admin_select
  on public.profiles
  for select
  to authenticated
  using (public.is_family_admin(family_id));

create policy profiles_admin_insert
  on public.profiles
  for insert
  to authenticated
  with check (public.is_family_admin(family_id));

create policy profiles_admin_update
  on public.profiles
  for update
  to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

create policy profiles_admin_delete
  on public.profiles
  for delete
  to authenticated
  using (public.is_family_admin(family_id));

create policy consultations_admin_select
  on public.consultations
  for select
  to authenticated
  using (public.is_profile_admin(profile_id));

create policy consultations_admin_insert
  on public.consultations
  for insert
  to authenticated
  with check (public.is_profile_admin(profile_id));

create policy consultations_admin_update
  on public.consultations
  for update
  to authenticated
  using (public.is_profile_admin(profile_id))
  with check (public.is_profile_admin(profile_id));

create policy consultations_admin_delete
  on public.consultations
  for delete
  to authenticated
  using (public.is_profile_admin(profile_id));

create policy lab_tests_admin_select
  on public.lab_tests
  for select
  to authenticated
  using (public.is_profile_admin(profile_id));

create policy lab_tests_admin_insert
  on public.lab_tests
  for insert
  to authenticated
  with check (public.is_profile_admin(profile_id));

create policy lab_tests_admin_update
  on public.lab_tests
  for update
  to authenticated
  using (public.is_profile_admin(profile_id))
  with check (public.is_profile_admin(profile_id));

create policy lab_tests_admin_delete
  on public.lab_tests
  for delete
  to authenticated
  using (public.is_profile_admin(profile_id));

create policy medical_documents_admin_select
  on public.medical_documents
  for select
  to authenticated
  using (public.is_profile_admin(profile_id));

create policy medical_documents_admin_insert
  on public.medical_documents
  for insert
  to authenticated
  with check (public.is_profile_admin(profile_id));

create policy medical_documents_admin_update
  on public.medical_documents
  for update
  to authenticated
  using (public.is_profile_admin(profile_id))
  with check (public.is_profile_admin(profile_id));

create policy medical_documents_admin_delete
  on public.medical_documents
  for delete
  to authenticated
  using (public.is_profile_admin(profile_id));

create policy google_drive_connections_admin_select
  on public.google_drive_connections
  for select
  to authenticated
  using (public.is_family_admin(family_id));

create policy google_drive_connections_admin_insert
  on public.google_drive_connections
  for insert
  to authenticated
  with check (public.is_family_admin(family_id));

create policy google_drive_connections_admin_update
  on public.google_drive_connections
  for update
  to authenticated
  using (public.is_family_admin(family_id))
  with check (public.is_family_admin(family_id));

create policy google_drive_connections_admin_delete
  on public.google_drive_connections
  for delete
  to authenticated
  using (public.is_family_admin(family_id));
