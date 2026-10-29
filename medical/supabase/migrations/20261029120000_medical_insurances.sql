-- Voluntary medical insurance history per profile (one policy file per year).

create table if not exists public.medical_insurances (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  start_date date not null,
  end_date date not null,
  source_document_id uuid references public.medical_documents (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  constraint medical_insurances_dates check (end_date >= start_date)
);

create index if not exists medical_insurances_profile_end_idx
  on public.medical_insurances (profile_id, end_date desc);

create index if not exists medical_insurances_source_document_idx
  on public.medical_insurances (source_document_id);

alter table public.medical_insurances enable row level security;

revoke all on table public.medical_insurances from anon, public;
grant select, insert, update, delete on table public.medical_insurances to authenticated;

drop policy if exists medical_insurances_member_select on public.medical_insurances;
create policy medical_insurances_member_select
  on public.medical_insurances
  for select
  to authenticated
  using (public.is_profile_member(profile_id));

drop policy if exists medical_insurances_editor_insert on public.medical_insurances;
create policy medical_insurances_editor_insert
  on public.medical_insurances
  for insert
  to authenticated
  with check (public.is_profile_editor(profile_id));

drop policy if exists medical_insurances_editor_update on public.medical_insurances;
create policy medical_insurances_editor_update
  on public.medical_insurances
  for update
  to authenticated
  using (public.is_profile_editor(profile_id))
  with check (public.is_profile_editor(profile_id));

drop policy if exists medical_insurances_editor_delete on public.medical_insurances;
create policy medical_insurances_editor_delete
  on public.medical_insurances
  for delete
  to authenticated
  using (public.is_profile_editor(profile_id));
