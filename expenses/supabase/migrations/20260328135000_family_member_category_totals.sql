-- Per-member aggregates for shared categories (no transaction row details).

create or replace function public.family_shared_category_member_totals()
returns table (
  category_id text,
  month text,
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
    substr(t.date, 1, 7),
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
  group by t.category, substr(t.date, 1, 7), t.user_id
  order by 2 desc, 1, 4 desc;
$$;

revoke all on function public.family_shared_category_member_totals() from public;
grant execute on function public.family_shared_category_member_totals() to authenticated;
