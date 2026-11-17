-- Recreate daily totals with user_id.
-- CREATE OR REPLACE cannot change OUT columns of the earlier 3-column version.

drop function if exists public.family_shared_category_daily_totals(text);

create function public.family_shared_category_daily_totals(p_month text)
returns table (
  category_id text,
  day text,
  user_id uuid,
  total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    t.category::text,
    t.date::text,
    t.user_id,
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
    and p_month is not null
    and length(p_month) = 7
    and t.type = 'transaction'
    and t.category is not null
    and t.date is not null
    and length(t.date) >= 10
    and substr(t.date, 1, 7) = p_month
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
  group by t.category, t.date, t.user_id
  having coalesce(
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
  ) > 0
  order by 2 desc, 1;
$$;

revoke all on function public.family_shared_category_daily_totals(text) from public;
grant execute on function public.family_shared_category_daily_totals(text) to authenticated;
