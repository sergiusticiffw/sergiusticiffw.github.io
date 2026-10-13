-- IDNP links a scanned document to a family profile.
-- One document can create one consultation and many lab rows.

alter table public.profiles
  add column idnp text check (idnp is null or idnp ~ '^[0-9]{13}$');

create unique index profiles_family_idnp_key
  on public.profiles (family_id, idnp)
  where idnp is not null;

alter table public.medical_documents
  add column extracted_text text check (
    extracted_text is null or char_length(extracted_text) <= 20000
  );

alter table public.consultations
  add column source_document_id uuid references public.medical_documents (id) on delete cascade;

alter table public.lab_tests
  add column source_document_id uuid references public.medical_documents (id) on delete cascade;

create index consultations_source_document_idx
  on public.consultations (source_document_id);

create index lab_tests_source_document_idx
  on public.lab_tests (source_document_id);
