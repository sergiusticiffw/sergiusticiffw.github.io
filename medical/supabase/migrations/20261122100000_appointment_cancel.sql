-- Appointment cancellation status.

alter table public.appointments
  add column if not exists cancelled_at timestamptz;

alter table public.appointments
  drop constraint if exists appointments_done_or_cancelled;

alter table public.appointments
  add constraint appointments_done_or_cancelled
  check (done_at is null or cancelled_at is null);

create index if not exists appointments_upcoming_idx
  on public.appointments (starts_at)
  where done_at is null and cancelled_at is null;
