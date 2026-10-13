-- Extra images belong to one record. The first file is the record;
-- the others point at it and are removed with it.

alter table public.medical_documents
  add column record_id uuid references public.medical_documents (id) on delete cascade;

alter table public.medical_documents
  add constraint medical_documents_record_not_self
  check (record_id is null or record_id <> id);

create index medical_documents_record_idx
  on public.medical_documents (record_id)
  where record_id is not null;
