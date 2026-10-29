-- Identity / civil documents per profile (buletin, certificat de naștere, etc.).

create table if not exists public.profile_identity_docs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  issued_date date,
  source_document_id uuid references public.medical_documents (id) on delete set null,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists profile_identity_docs_profile_idx
  on public.profile_identity_docs (profile_id, created_at desc);

create index if not exists profile_identity_docs_source_document_idx
  on public.profile_identity_docs (source_document_id);

alter table public.profile_identity_docs enable row level security;

revoke all on table public.profile_identity_docs from anon, public;
grant select, insert, update, delete on table public.profile_identity_docs to authenticated;

drop policy if exists profile_identity_docs_member_select on public.profile_identity_docs;
create policy profile_identity_docs_member_select
  on public.profile_identity_docs
  for select
  to authenticated
  using (public.is_profile_member(profile_id));

drop policy if exists profile_identity_docs_editor_insert on public.profile_identity_docs;
create policy profile_identity_docs_editor_insert
  on public.profile_identity_docs
  for insert
  to authenticated
  with check (public.is_profile_editor(profile_id));

drop policy if exists profile_identity_docs_editor_update on public.profile_identity_docs;
create policy profile_identity_docs_editor_update
  on public.profile_identity_docs
  for update
  to authenticated
  using (public.is_profile_editor(profile_id))
  with check (public.is_profile_editor(profile_id));

drop policy if exists profile_identity_docs_editor_delete on public.profile_identity_docs;
create policy profile_identity_docs_editor_delete
  on public.profile_identity_docs
  for delete
  to authenticated
  using (public.is_profile_editor(profile_id));
