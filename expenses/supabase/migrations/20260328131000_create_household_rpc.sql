-- Fix household creation under RLS: bootstrap via security definer RPC.
-- Also grant table privileges to authenticated (required alongside RLS).

grant select, insert, update, delete on public.households to authenticated;
grant select, insert, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.household_invites to authenticated;
grant select, insert, update, delete on public.household_shared_categories to authenticated;

create or replace function public.create_household(p_name text default 'Family')
returns public.households
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_house public.households;
  v_defaults text[] := array['6', '3', '10', '5', '12', '9'];
  v_cat text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (
    select 1 from public.household_members m where m.user_id = v_uid
  ) then
    raise exception 'You already belong to a household';
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'Family'), v_uid)
  returning * into v_house;

  insert into public.household_members (household_id, user_id, role)
  values (v_house.id, v_uid, 'owner');

  foreach v_cat in array v_defaults
  loop
    insert into public.household_shared_categories (household_id, category_id)
    values (v_house.id, v_cat)
    on conflict do nothing;
  end loop;

  return v_house;
end;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
