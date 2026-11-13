-- Wipe all app rows for one user (keeps auth.users + profiles row).
-- Run in Supabase Dashboard → SQL Editor.
-- Replace the UUID below.

do $$
declare
  v_uid uuid := 'PASTE-USER-UUID-HERE'::uuid;
  n_pay int;
  n_loan int;
  n_tx int;
begin
  select count(*) into n_pay from public.payments where user_id = v_uid;
  select count(*) into n_loan from public.loans where user_id = v_uid;
  select count(*) into n_tx from public.transactions where user_id = v_uid;
  raise notice 'Before: payments=%, loans=%, transactions=%', n_pay, n_loan, n_tx;

  delete from public.payments where user_id = v_uid;
  delete from public.loans where user_id = v_uid;
  delete from public.transactions where user_id = v_uid;

  -- optional: clean tags/gemini so re-import starts fresh
  update public.profiles
  set
    tag_mode = 'default',
    custom_tags = '{}'::jsonb,
    gemini_api_key = null,
    updated_at = now()
  where id = v_uid;

  raise notice 'Wiped data for %', v_uid;
end $$;
