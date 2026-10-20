-- Track Gemini assistant usage per family and Pacific calendar day.
-- Daily Google AI quotas reset at midnight America/Los_Angeles.

create table public.ai_usage_days (
  family_id uuid not null references public.families (id) on delete cascade,
  usage_date date not null,
  questions integer not null default 0 check (questions >= 0),
  requests integer not null default 0 check (requests >= 0),
  tokens integer not null default 0 check (tokens >= 0),
  last_model text,
  updated_at timestamptz not null default now(),
  primary key (family_id, usage_date)
);

create table public.ai_model_limits (
  family_id uuid not null references public.families (id) on delete cascade,
  model text not null check (char_length(model) between 1 and 80),
  hit_at timestamptz not null default now(),
  until timestamptz not null,
  status integer not null,
  daily boolean not null default false,
  retry_after_seconds integer check (
    retry_after_seconds is null or retry_after_seconds >= 0
  ),
  quota_id text,
  quota_limit integer,
  primary key (family_id, model)
);

alter table public.ai_usage_days enable row level security;
alter table public.ai_model_limits enable row level security;

revoke all on table public.ai_usage_days from anon, public;
revoke all on table public.ai_model_limits from anon, public;
grant select, insert, update on table public.ai_usage_days to authenticated;
grant select, insert, update, delete on table public.ai_model_limits to authenticated;

create policy ai_usage_days_member_select
  on public.ai_usage_days
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy ai_usage_days_member_insert
  on public.ai_usage_days
  for insert
  to authenticated
  with check (public.is_family_member(family_id));

create policy ai_usage_days_member_update
  on public.ai_usage_days
  for update
  to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy ai_model_limits_member_select
  on public.ai_model_limits
  for select
  to authenticated
  using (public.is_family_member(family_id));

create policy ai_model_limits_member_insert
  on public.ai_model_limits
  for insert
  to authenticated
  with check (public.is_family_member(family_id));

create policy ai_model_limits_member_update
  on public.ai_model_limits
  for update
  to authenticated
  using (public.is_family_member(family_id))
  with check (public.is_family_member(family_id));

create policy ai_model_limits_member_delete
  on public.ai_model_limits
  for delete
  to authenticated
  using (public.is_family_member(family_id));
