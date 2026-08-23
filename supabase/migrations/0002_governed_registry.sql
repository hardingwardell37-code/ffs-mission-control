-- Phase 1 governed registry. Apply after 0001_mission_control_foundation.sql.
alter type public.task_status add value if not exists 'draft' before 'queued';
alter type public.task_status add value if not exists 'blocked' after 'running';
alter type public.approval_status add value if not exists 'cancelled' after 'rejected';

create type public.membership_role as enum ('owner','admin','operator','viewer');
create type public.membership_status as enum ('invited','active','suspended');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.membership_role not null default 'viewer',
  status public.membership_status not null default 'invited',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.agents add column organization_id uuid references public.organizations(id);
alter table public.agents add column purpose text not null default '';
alter table public.agents add column archived_at timestamptz;
alter table public.tasks add column organization_id uuid references public.organizations(id);
alter table public.approvals add column organization_id uuid references public.organizations(id);
alter table public.audit_events add column organization_id uuid references public.organizations(id);

alter table public.agents drop constraint if exists agents_slug_key;
create unique index agents_organization_slug_key on public.agents(organization_id, slug) where archived_at is null;
create index memberships_user_active_idx on public.organization_memberships(user_id, organization_id) where status = 'active';
create index tasks_organization_status_idx on public.tasks(organization_id, status, created_at desc);
create index approvals_organization_status_idx on public.approvals(organization_id, status, requested_at desc);
create index audit_organization_created_idx on public.audit_events(organization_id, created_at desc);

create or replace function public.is_org_member(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id = target_org and m.user_id = auth.uid() and m.status = 'active');
$$;
create or replace function public.can_manage_org(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_memberships m where m.organization_id = target_org and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin','operator'));
$$;
revoke all on function public.is_org_member(uuid) from public; grant execute on function public.is_org_member(uuid) to authenticated;
revoke all on function public.can_manage_org(uuid) from public; grant execute on function public.can_manage_org(uuid) to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_memberships enable row level security;

drop policy if exists "authenticated users read agents" on public.agents;
drop policy if exists "authenticated users manage agents" on public.agents;
drop policy if exists "authenticated users read tool permissions" on public.agent_tool_permissions;
drop policy if exists "authenticated users manage tool permissions" on public.agent_tool_permissions;
drop policy if exists "authenticated users read tasks" on public.tasks;
drop policy if exists "authenticated users manage tasks" on public.tasks;
drop policy if exists "authenticated users read approvals" on public.approvals;
drop policy if exists "authenticated users manage approvals" on public.approvals;
drop policy if exists "authenticated users read audit" on public.audit_events;

create policy organizations_read on public.organizations for select to authenticated using (public.is_org_member(id));
create policy profiles_read_self on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy memberships_read_org on public.organization_memberships for select to authenticated using (public.is_org_member(organization_id));
create policy agents_read_org on public.agents for select to authenticated using (public.is_org_member(organization_id));
create policy agents_insert_org on public.agents for insert to authenticated with check (public.can_manage_org(organization_id) and created_by = auth.uid());
create policy agents_update_org on public.agents for update to authenticated using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy permissions_read_org on public.agent_tool_permissions for select to authenticated using (exists(select 1 from public.agents a where a.id=agent_id and public.is_org_member(a.organization_id)));
create policy permissions_manage_org on public.agent_tool_permissions for all to authenticated using (exists(select 1 from public.agents a where a.id=agent_id and public.can_manage_org(a.organization_id))) with check (exists(select 1 from public.agents a where a.id=agent_id and public.can_manage_org(a.organization_id)));
create policy tasks_read_org on public.tasks for select to authenticated using (public.is_org_member(organization_id));
create policy tasks_insert_org on public.tasks for insert to authenticated with check (public.can_manage_org(organization_id) and requested_by=auth.uid() and status::text in ('draft','queued'));
create policy tasks_update_org on public.tasks for update to authenticated using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy approvals_read_org on public.approvals for select to authenticated using (public.is_org_member(organization_id));
create policy approvals_update_org on public.approvals for update to authenticated using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy audit_read_org on public.audit_events for select to authenticated using (public.is_org_member(organization_id));
create policy audit_insert_org on public.audit_events for insert to authenticated with check (public.can_manage_org(organization_id) and actor_type='user' and actor_id=auth.uid()::text);

create or replace function public.prevent_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'audit events are append-only'; end $$;
create trigger audit_events_no_update_delete before update or delete on public.audit_events for each row execute function public.prevent_audit_mutation();

create or replace function public.validate_task_organization() returns trigger language plpgsql set search_path='' as $$
begin if not exists(select 1 from public.agents a where a.id=new.agent_id and a.organization_id=new.organization_id and a.archived_at is null) then raise exception 'agent is not available in this organization'; end if; return new; end $$;
create trigger tasks_validate_agent before insert or update of agent_id,organization_id on public.tasks for each row execute function public.validate_task_organization();

create or replace function public.validate_approval_organization() returns trigger language plpgsql set search_path='' as $$
begin if not exists(select 1 from public.tasks t where t.id=new.task_id and t.organization_id=new.organization_id) then raise exception 'task is not in this organization'; end if; return new; end $$;
create trigger approvals_validate_task before insert or update of task_id,organization_id on public.approvals for each row execute function public.validate_approval_organization();

create or replace function public.enforce_task_transition() returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if not ((old.status::text='draft' and new.status::text in ('queued','cancelled')) or (old.status::text='queued' and new.status::text in ('running','blocked','cancelled')) or (old.status::text='running' and new.status::text in ('blocked','awaiting_approval','completed','failed','cancelled')) or (old.status::text='blocked' and new.status::text in ('queued','cancelled')) or (old.status::text='awaiting_approval' and new.status::text in ('running','blocked','cancelled'))) then raise exception 'invalid task transition: % -> %',old.status,new.status; end if;
  return new;
end $$;
create trigger tasks_enforce_transition before update of status on public.tasks for each row execute function public.enforce_task_transition();

create or replace function public.enforce_approval_transition() returns trigger language plpgsql as $$
begin
  if old.status = new.status then return new; end if;
  if old.status::text <> 'pending' or new.status::text not in ('approved','rejected','cancelled','expired') then raise exception 'invalid approval transition: % -> %',old.status,new.status; end if;
  return new;
end $$;
create trigger approvals_enforce_transition before update of status on public.approvals for each row execute function public.enforce_approval_transition();

-- Existing rows must be assigned to an organization before enforcing NOT NULL.
-- Fresh installations have no legacy rows; established installations should backfill explicitly.
