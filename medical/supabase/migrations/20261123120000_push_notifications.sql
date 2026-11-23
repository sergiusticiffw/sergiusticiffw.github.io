-- Web Push subscriptions + daily appointment reminder deliveries.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_unique unique (endpoint),
  constraint push_subscriptions_endpoint_length check (
    char_length(endpoint) between 1 and 2048
  ),
  constraint push_subscriptions_p256dh_length check (
    char_length(p256dh) between 1 and 512
  ),
  constraint push_subscriptions_auth_length check (
    char_length(auth) between 1 and 512
  )
);

-- Older partial runs may lack user_agent / updated_at.
alter table public.push_subscriptions
  add column if not exists user_agent text;

alter table public.push_subscriptions
  add column if not exists updated_at timestamptz not null default now();

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

revoke all on table public.push_subscriptions from anon, public;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

drop policy if exists push_subscriptions_owner_select on public.push_subscriptions;
create policy push_subscriptions_owner_select
  on public.push_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists push_subscriptions_owner_insert on public.push_subscriptions;
create policy push_subscriptions_owner_insert
  on public.push_subscriptions
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_owner_update on public.push_subscriptions;
create policy push_subscriptions_owner_update
  on public.push_subscriptions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_owner_delete on public.push_subscriptions;
create policy push_subscriptions_owner_delete
  on public.push_subscriptions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Dedup daily reminders (today / tomorrow), keyed per user + appointment.

create table if not exists public.appointment_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reminder_kind text not null,
  sent_at timestamptz not null default now(),
  constraint appointment_notification_deliveries_unique
    unique (appointment_id, user_id, reminder_kind)
);

-- Align reminder_kind with daily today/tomorrow cron (replace older day_before/hour_before).
alter table public.appointment_notification_deliveries
  drop constraint if exists appointment_notification_deliveries_reminder_kind_check;

delete from public.appointment_notification_deliveries
where reminder_kind not in ('today', 'tomorrow');

alter table public.appointment_notification_deliveries
  add constraint appointment_notification_deliveries_reminder_kind_check
  check (reminder_kind in ('today', 'tomorrow'));

create index if not exists appointment_notification_deliveries_sent_idx
  on public.appointment_notification_deliveries (sent_at);

alter table public.appointment_notification_deliveries enable row level security;

revoke all on table public.appointment_notification_deliveries from anon, public;
-- Only the service role (cron) writes deliveries; authenticated users need no access.
