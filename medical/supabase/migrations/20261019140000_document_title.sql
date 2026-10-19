alter table public.medical_documents
  add column title text;

alter table public.medical_documents
  add constraint medical_documents_title_length
  check (title is null or char_length(btrim(title)) between 1 and 160);
