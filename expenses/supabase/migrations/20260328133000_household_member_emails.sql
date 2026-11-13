-- Expose household member emails to co-members (for Family UI labels).
-- auth.users is not readable via PostgREST; use a security-definer RPC.

create or replace function public.household_members_with_email(p_household_id uuid)
returns table (
  user_id uuid,
  role text,
  joined_at timestamptz,
  email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_household_id is null or not public.is_household_member(p_household_id) then
    raise exception 'Not a household member';
  end if;

  return query
  select
    m.user_id,
    m.role,
    m.joined_at,
    lower(coalesce(u.email, ''))::text as email
  from public.household_members m
  left join auth.users u on u.id = m.user_id
  where m.household_id = p_household_id
  order by
    case m.role when 'owner' then 0 when 'admin' then 1 else 2 end,
    m.joined_at asc nulls last;
end;
$$;

revoke all on function public.household_members_with_email(uuid) from public;
grant execute on function public.household_members_with_email(uuid) to authenticated;
