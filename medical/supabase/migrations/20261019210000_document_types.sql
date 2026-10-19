-- Allow Word (.docx) and plain text documents next to PDF and images.
alter table public.medical_documents
  drop constraint if exists medical_documents_mime_type_check;

alter table public.medical_documents
  add constraint medical_documents_mime_type_check check (
    mime_type in (
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
  );
