create extension if not exists pgcrypto;

create type public.agent_status as enum ('draft','active','paused','disabled');
create type public.task_status as enum ('queued','running','awaiting_approval','completed','failed','cancelled');
create type public.approval_status as enum ('pending','approved','rejected','expired');

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  status public.agent_status not null default 'draft',
  model_provider text not null,
  model_name text not null,
  system_instructions text not null,
  max_runtime_seconds integer not null default 300 check (max_runtime_seconds between 1 and 3600),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_tool_permissions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id) on delete cascade,
  tool_key text not null,
  can_read boolean not null default false,
  can_write boolean not null default false,
  requires_approval boolean not null default true,
  unique(agent_id, tool_key)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents(id),
  title text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status public.task_status not null default 'queued',
  requested_by uuid references auth.users(id),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  action_key text not null,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.approval_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolution_note text
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null check (actor_type in ('user','agent','system')),
  actor_id text,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agents enable row level security;
alter table public.agent_tool_permissions enable row level security;
alter table public.tasks enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_events enable row level security;

-- Private single-owner foundation. Replace with organization membership policies before inviting any additional user.
create policy "authenticated users read agents" on public.agents for select to authenticated using (true);
create policy "authenticated users manage agents" on public.agents for all to authenticated using (true) with check (true);
create policy "authenticated users read tool permissions" on public.agent_tool_permissions for select to authenticated using (true);
create policy "authenticated users manage tool permissions" on public.agent_tool_permissions for all to authenticated using (true) with check (true);
create policy "authenticated users read tasks" on public.tasks for select to authenticated using (true);
create policy "authenticated users manage tasks" on public.tasks for all to authenticated using (true) with check (true);
create policy "authenticated users read approvals" on public.approvals for select to authenticated using (true);
create policy "authenticated users manage approvals" on public.approvals for all to authenticated using (true) with check (true);
create policy "authenticated users read audit" on public.audit_events for select to authenticated using (true);
