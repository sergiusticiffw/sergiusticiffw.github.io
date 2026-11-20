-- Health tracking per person: medications, appointments, vaccinations and
-- measurements.
--
-- These tables hold what the family writes down or copies from a document.
-- Nothing here is computed, diagnosed or inferred. `source` says where a row
-- came from ('family' = typed in by a family member, 'document' = copied from
-- an uploaded document, linked by source_document_id), and `created_by` says
-- who added it.
--
-- Access mirrors consultations: members who may see the person can read,
-- editors and admins can write (is_profile_member / is_profile_editor).
-- Deleting a person cascades. Deleting a source document keeps the row and
-- clears the link.

create or replace function public.profile_id_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.profile_id is distinct from old.profile_id then
    raise exception 'profile_id cannot be changed'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- medications -----------------------------------------------------------------

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  dose text check (dose is null or char_length(dose) <= 120),
  schedule text check (schedule is null or char_length(schedule) <= 200),
  prescribed_by text check (prescribed_by is null or char_length(prescribed_by) <= 160),
  start_date date,
  end_date date,
  notes text check (notes is null or char_length(notes) <= 2000),
  source text not null default 'family' check (source in ('family', 'document')),
  source_document_id uuid references public.medical_documents (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint medications_dates check (
    end_date is null or start_date is null or end_date >= start_date
  )
);

create index if not exists medications_profile_idx
  on public.medications (profile_id, start_date desc nulls last);
create index if not exists medications_source_document_idx
  on public.medications (source_document_id);

-- appointments ----------------------------------------------------------------

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  starts_at timestamptz not null,
  doctor text check (doctor is null or char_length(doctor) <= 160),
  location text check (location is null or char_length(location) <= 200),
  notes text check (notes is null or char_length(notes) <= 2000),
  done_at timestamptz,
  source text not null default 'family' check (source in ('family', 'document')),
  source_document_id uuid references public.medical_documents (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists appointments_profile_idx
  on public.appointments (profile_id, starts_at desc);
create index if not exists appointments_source_document_idx
  on public.appointments (source_document_id);

-- vaccinations ----------------------------------------------------------------

create table if not exists public.vaccinations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  vaccine_name text not null check (char_length(btrim(vaccine_name)) between 1 and 160),
  given_on date not null,
  dose_label text check (dose_label is null or char_length(dose_label) <= 80),
  lot_number text check (lot_number is null or char_length(lot_number) <= 80),
  administered_by text check (administered_by is null or char_length(administered_by) <= 160),
  next_due_on date,
  notes text check (notes is null or char_length(notes) <= 2000),
  source text not null default 'family' check (source in ('family', 'document')),
  source_document_id uuid references public.medical_documents (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists vaccinations_profile_idx
  on public.vaccinations (profile_id, given_on desc);
create index if not exists vaccinations_source_document_idx
  on public.vaccinations (source_document_id);

-- measurements ----------------------------------------------------------------

create table if not exists public.measurements (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (
    kind in ('weight', 'height', 'temperature', 'blood_pressure', 'pulse', 'glucose', 'other')
  ),
  label text check (label is null or char_length(label) <= 80),
  value numeric,
  value_text text check (value_text is null or char_length(value_text) <= 40),
  unit text check (unit is null or char_length(unit) <= 20),
  measured_on date not null,
  notes text check (notes is null or char_length(notes) <= 1000),
  source text not null default 'family' check (source in ('family', 'document')),
  source_document_id uuid references public.medical_documents (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint measurements_has_value check (value is not null or value_text is not null)
);

create index if not exists measurements_profile_idx
  on public.measurements (profile_id, kind, measured_on desc);
create index if not exists measurements_source_document_idx
  on public.measurements (source_document_id);

-- guards, grants and RLS --------------------------------------------------------

do $$
declare
  tbl text;
begin
  foreach tbl in array array['medications', 'appointments', 'vaccinations', 'measurements']
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('revoke all on table public.%I from anon, public', tbl);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_member_select', tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_profile_member(profile_id))',
      tbl || '_member_select', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_editor_insert', tbl);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.is_profile_editor(profile_id) and (created_by is null or created_by = auth.uid()))',
      tbl || '_editor_insert', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_editor_update', tbl);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_profile_editor(profile_id)) with check (public.is_profile_editor(profile_id))',
      tbl || '_editor_update', tbl
    );

    execute format('drop policy if exists %I on public.%I', tbl || '_editor_delete', tbl);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_profile_editor(profile_id))',
      tbl || '_editor_delete', tbl
    );

    execute format('drop trigger if exists %I on public.%I', tbl || '_source_guard', tbl);
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.source_document_same_profile_guard()',
      tbl || '_source_guard', tbl
    );

    execute format('drop trigger if exists %I on public.%I', tbl || '_profile_immutable', tbl);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.profile_id_immutable()',
      tbl || '_profile_immutable', tbl
    );
  end loop;
end;
$$;
