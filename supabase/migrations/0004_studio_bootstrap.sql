-- Bootstrap studio access for authenticated operators.
-- SECURITY DEFINER so membership/org creation works without public insert RLS.
-- No anon write policies are added.

create or replace function public.ensure_studio_access()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  org_id uuid;
  short_id text;
  display text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(nullif(u.raw_user_meta_data->>'display_name', ''), split_part(u.email, '@', 1), 'operator')
    into display
  from auth.users u
  where u.id = uid;

  insert into public.profiles (id, display_name, updated_at)
  values (uid, display, now())
  on conflict (id) do update
    set display_name = coalesce(public.profiles.display_name, excluded.display_name),
        updated_at = now();

  select m.organization_id into org_id
  from public.organization_memberships m
  where m.user_id = uid and m.status = 'active'
  order by m.created_at asc
  limit 1;

  if org_id is not null then
    return org_id;
  end if;

  short_id := substr(replace(uid::text, '-', ''), 1, 8);

  begin
    insert into public.organizations (name, slug)
    values ('F&P Studio', 'fp-studio-' || short_id)
    returning id into org_id;
  exception
    when unique_violation then
      select o.id into org_id
      from public.organizations o
      where o.slug = 'fp-studio-' || short_id;
  end;

  insert into public.organization_memberships (organization_id, user_id, role, status)
  values (org_id, uid, 'owner', 'active')
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = 'active';

  return org_id;
end;
$$;

revoke all on function public.ensure_studio_access() from public;
grant execute on function public.ensure_studio_access() to authenticated;
