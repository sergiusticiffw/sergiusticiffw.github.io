-- Supabase-only early/extra payment flag (Drupal has no matching field).
alter table public.payments
  add column if not exists fiep text default '0';
