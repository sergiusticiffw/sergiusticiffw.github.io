-- Expenses app schema for Supabase provider
-- Enable Google auth in Dashboard → Authentication → Providers.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  currency text default 'MDL',
  tag_mode text not null default 'default' check (tag_mode in ('default', 'custom')),
  custom_tags jsonb not null default '{}'::jsonb,
  gemini_api_key text,
  encryption_status text default 'off',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- transactions (expenses + incomes)
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('transaction', 'incomes')),
  amount text not null default '',
  date text not null default '',
  description text not null default '',
  category text,
  encrypted_payload text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, date desc);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on public.transactions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- loans
-- ---------------------------------------------------------------------------
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text default '',
  fp text default '',
  sdt text default '',
  edt text default '',
  fr text default '',
  fpm text default '',
  fif text default '',
  pdt text default '',
  frpd text default '',
  fls text default '',
  encrypted_payload text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_user_idx on public.loans (user_id);

alter table public.loans enable row level security;

create policy "loans_select_own"
  on public.loans for select
  using (auth.uid() = user_id);

create policy "loans_insert_own"
  on public.loans for insert
  with check (auth.uid() = user_id);

create policy "loans_update_own"
  on public.loans for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "loans_delete_own"
  on public.loans for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  loan_id uuid references public.loans (id) on delete cascade,
  title text default '',
  fdt text default '',
  fr text default '',
  fpi text default '',
  fpsf text default '',
  fnra text default '',
  fnp text default '',
  fpm text default '',
  fisp text default '0',
  encrypted_payload text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_loan_idx on public.payments (loan_id);

alter table public.payments enable row level security;

create policy "payments_select_own"
  on public.payments for select
  using (auth.uid() = user_id);

create policy "payments_insert_own"
  on public.payments for insert
  with check (auth.uid() = user_id);

create policy "payments_update_own"
  on public.payments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "payments_delete_own"
  on public.payments for delete
  using (auth.uid() = user_id);
