-- Family view: aggregates only. No partner transaction rows via RLS.

drop policy if exists "transactions_select_family_shared" on public.transactions;

-- Monthly totals per shared category across the caller's household.
-- Pure SQL (avoids plpgsql OUT-param name clashes). No row-level details.
create or replace function public.family_shared_category_totals()
returns table (
  category_id text,
  month text,
  total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.category::text,
    substr(t.date, 1, 7),
    coalesce(
      sum(
        case
          when trim(t.amount) ~ '^-?[0-9]+(\.[0-9]+)?$'
            then trim(t.amount)::numeric
          when trim(t.amount) ~ '^-?[0-9]+,[0-9]+$'
            then replace(trim(t.amount), ',', '.')::numeric
          when nullif(regexp_replace(trim(t.amount), '[^0-9,.\-]', '', 'g'), '')
            ~ '^-?[0-9]+([.,][0-9]+)?$'
            then replace(
              regexp_replace(trim(t.amount), '[^0-9,.\-]', '', 'g'),
              ',',
              '.'
            )::numeric
          else 0::numeric
        end
      ),
      0
    )
  from public.transactions t
  where auth.uid() is not null
    and public.my_household_id() is not null
    and t.type = 'transaction'
    and t.category is not null
    and length(substr(t.date, 1, 7)) = 7
    and exists (
      select 1
      from public.household_members m
      where m.household_id = public.my_household_id()
        and m.user_id = t.user_id
    )
    and exists (
      select 1
      from public.household_shared_categories sc
      where sc.household_id = public.my_household_id()
        and sc.category_id = t.category
    )
  group by t.category, substr(t.date, 1, 7)
  order by 2 desc, 1;
$$;

revoke all on function public.family_shared_category_totals() from public;
grant execute on function public.family_shared_category_totals() to authenticated;
