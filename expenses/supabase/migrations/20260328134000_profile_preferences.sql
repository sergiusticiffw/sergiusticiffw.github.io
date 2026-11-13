-- Portable UI / app preferences (theme, language, charts, AI prefs, goals cache).
-- Synced from the client when VITE/data provider is Supabase.

alter table public.profiles
  add column if not exists preferences jsonb not null default '{}'::jsonb;
