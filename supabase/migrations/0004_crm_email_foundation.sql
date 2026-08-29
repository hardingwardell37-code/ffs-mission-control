-- Organization-scoped CRM and email persistence. No provider connectivity or delivery runtime.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 1 and 160), domain text, website_url text, phone text,
  industry text, employee_size text, address_line_1 text, address_line_2 text, city text, state_region text,
  postal_code text, country text, status text not null default 'active' check (status in ('prospect','active','inactive')),
  owner_user_id uuid references auth.users(id), source text, notes text, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz
);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  company_id uuid references public.companies(id), first_name text not null, last_name text not null default '',
  display_name text not null, job_title text, email text, phone text, mobile_phone text, linkedin_url text,
  preferred_channel text check (preferred_channel is null or preferred_channel in ('email','phone','mobile','linkedin','other')),
  status text not null default 'active' check (status in ('prospect','active','inactive')), source text, notes text,
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), archived_at timestamptz
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  contact_id uuid references public.contacts(id), company_id uuid references public.companies(id), title text not null,
  source text, status text not null default 'new' check (status in ('new','working','qualified','unqualified','converted')),
  score integer check (score is null or score between 0 and 100), estimated_value numeric(14,2) check (estimated_value is null or estimated_value >= 0),
  currency char(3) not null default 'USD', owner_user_id uuid references auth.users(id), assigned_agent_id uuid references public.agents(id),
  next_action_at timestamptz, notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), converted_at timestamptz, archived_at timestamptz
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  company_id uuid references public.companies(id), primary_contact_id uuid references public.contacts(id), lead_id uuid references public.leads(id),
  name text not null, stage text not null default 'new' check (stage in ('new','qualified','discovery','proposal','negotiation','won','lost')),
  status text not null default 'open' check (status in ('open','won','lost')), estimated_value numeric(14,2) not null default 0 check (estimated_value >= 0),
  currency char(3) not null default 'USD', probability integer check (probability is null or probability between 0 and 100), expected_close_date date,
  owner_user_id uuid references auth.users(id), assigned_agent_id uuid references public.agents(id), next_action_at timestamptz,
  lost_reason text, notes text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), closed_at timestamptz, archived_at timestamptz
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  company_id uuid references public.companies(id), contact_id uuid references public.contacts(id), lead_id uuid references public.leads(id),
  opportunity_id uuid references public.opportunities(id), activity_type text not null check (activity_type in ('note','call','meeting','email','stage_change','follow_up','proposal','system')),
  subject text not null, body text, occurred_at timestamptz not null default now(), created_by_user_id uuid references auth.users(id),
  created_by_agent_id uuid references public.agents(id), metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(),
  check (created_by_user_id is not null or created_by_agent_id is not null)
);

create table if not exists public.email_threads (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  company_id uuid references public.companies(id), contact_id uuid references public.contacts(id), lead_id uuid references public.leads(id),
  opportunity_id uuid references public.opportunities(id), provider text not null default 'unconnected', provider_thread_id text,
  subject text, status text not null default 'open' check (status in ('open','closed','archived')),
  last_message_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, provider, provider_thread_id)
);

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  thread_id uuid not null references public.email_threads(id) on delete cascade, provider text not null default 'unconnected', provider_message_id text,
  direction text not null check (direction in ('inbound','outbound','draft')), from_address text not null,
  to_addresses text[] not null default '{}', cc_addresses text[], bcc_addresses text[], subject text, body_text text, body_html text,
  sent_at timestamptz, received_at timestamptz,
  draft_status text not null default 'draft' check (draft_status in ('draft','pending_approval','approved','rejected','sent','received')),
  created_by_user_id uuid references auth.users(id), created_by_agent_id uuid references public.agents(id),
  approval_id uuid references public.approvals(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (organization_id, provider, provider_message_id)
);

create index if not exists companies_org_status_idx on public.companies(organization_id,status,name) where archived_at is null;
create index if not exists contacts_org_name_idx on public.contacts(organization_id,display_name) where archived_at is null;
create index if not exists leads_org_status_idx on public.leads(organization_id,status,next_action_at) where archived_at is null;
create index if not exists opportunities_org_stage_idx on public.opportunities(organization_id,status,stage,next_action_at) where archived_at is null;
create index if not exists crm_activities_org_time_idx on public.crm_activities(organization_id,occurred_at desc);
create index if not exists email_threads_org_time_idx on public.email_threads(organization_id,last_message_at desc);
create index if not exists email_messages_thread_time_idx on public.email_messages(thread_id,created_at);

alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.crm_activities enable row level security;
alter table public.email_threads enable row level security;
alter table public.email_messages enable row level security;

do $$ declare t text; begin
  foreach t in array array['companies','contacts','leads','opportunities','crm_activities','email_threads','email_messages'] loop
    execute format('drop policy if exists %I on public.%I',t||'_read_org',t);
    execute format('drop policy if exists %I on public.%I',t||'_manage_org',t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_org_member(organization_id))',t||'_read_org',t);
    execute format('create policy %I on public.%I for all to authenticated using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id))',t||'_manage_org',t);
  end loop;
end $$;

create or replace function public.validate_crm_party_organization() returns trigger language plpgsql set search_path='' as $$
declare r jsonb := to_jsonb(new); v_org uuid := (to_jsonb(new)->>'organization_id')::uuid;
begin
  if tg_table_name='contacts' and r->>'company_id' is not null and not exists(select 1 from public.companies x where x.id=(r->>'company_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'company is not in this organization'; end if;
  if tg_table_name='leads' then
    if r->>'company_id' is not null and not exists(select 1 from public.companies x where x.id=(r->>'company_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'company is not in this organization'; end if;
    if r->>'contact_id' is not null and not exists(select 1 from public.contacts x where x.id=(r->>'contact_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'contact is not in this organization'; end if;
    if r->>'assigned_agent_id' is not null and not exists(select 1 from public.agents x where x.id=(r->>'assigned_agent_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'agent is not in this organization'; end if;
  end if;
  if tg_table_name='opportunities' then
    if r->>'company_id' is not null and not exists(select 1 from public.companies x where x.id=(r->>'company_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'company is not in this organization'; end if;
    if r->>'primary_contact_id' is not null and not exists(select 1 from public.contacts x where x.id=(r->>'primary_contact_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'contact is not in this organization'; end if;
    if r->>'lead_id' is not null and not exists(select 1 from public.leads x where x.id=(r->>'lead_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'lead is not in this organization'; end if;
    if r->>'assigned_agent_id' is not null and not exists(select 1 from public.agents x where x.id=(r->>'assigned_agent_id')::uuid and x.organization_id=v_org and x.archived_at is null) then raise exception 'agent is not in this organization'; end if;
  end if;
  if tg_table_name in ('companies','leads','opportunities') and r->>'owner_user_id' is not null and not exists(select 1 from public.organization_memberships x where x.user_id=(r->>'owner_user_id')::uuid and x.organization_id=v_org and x.status='active') then raise exception 'owner is not an active organization member'; end if;
  return new;
end $$;

create or replace function public.validate_crm_activity_organization() returns trigger language plpgsql set search_path='' as $$
begin
  if new.company_id is not null and not exists(select 1 from public.companies x where x.id=new.company_id and x.organization_id=new.organization_id) then raise exception 'activity company is not in this organization'; end if;
  if new.contact_id is not null and not exists(select 1 from public.contacts x where x.id=new.contact_id and x.organization_id=new.organization_id) then raise exception 'activity contact is not in this organization'; end if;
  if new.lead_id is not null and not exists(select 1 from public.leads x where x.id=new.lead_id and x.organization_id=new.organization_id) then raise exception 'activity lead is not in this organization'; end if;
  if new.opportunity_id is not null and not exists(select 1 from public.opportunities x where x.id=new.opportunity_id and x.organization_id=new.organization_id) then raise exception 'activity opportunity is not in this organization'; end if;
  if new.created_by_agent_id is not null and not exists(select 1 from public.agents x where x.id=new.created_by_agent_id and x.organization_id=new.organization_id) then raise exception 'activity agent is not in this organization'; end if;
  if new.created_by_user_id is not null and not exists(select 1 from public.organization_memberships x where x.user_id=new.created_by_user_id and x.organization_id=new.organization_id and x.status='active') then raise exception 'activity user is not in this organization'; end if;
  return new;
end $$;

create or replace function public.validate_email_thread_organization() returns trigger language plpgsql set search_path='' as $$
begin
  if new.company_id is not null and not exists(select 1 from public.companies x where x.id=new.company_id and x.organization_id=new.organization_id) then raise exception 'email company is not in this organization'; end if;
  if new.contact_id is not null and not exists(select 1 from public.contacts x where x.id=new.contact_id and x.organization_id=new.organization_id) then raise exception 'email contact is not in this organization'; end if;
  if new.lead_id is not null and not exists(select 1 from public.leads x where x.id=new.lead_id and x.organization_id=new.organization_id) then raise exception 'email lead is not in this organization'; end if;
  if new.opportunity_id is not null and not exists(select 1 from public.opportunities x where x.id=new.opportunity_id and x.organization_id=new.organization_id) then raise exception 'email opportunity is not in this organization'; end if;
  return new;
end $$;

create or replace function public.validate_email_message_organization() returns trigger language plpgsql set search_path='' as $$
begin
  if not exists(select 1 from public.email_threads x where x.id=new.thread_id and x.organization_id=new.organization_id) then raise exception 'email thread is not in this organization'; end if;
  if new.created_by_agent_id is not null and not exists(select 1 from public.agents x where x.id=new.created_by_agent_id and x.organization_id=new.organization_id) then raise exception 'email author agent is not in this organization'; end if;
  if new.created_by_user_id is not null and not exists(select 1 from public.organization_memberships x where x.user_id=new.created_by_user_id and x.organization_id=new.organization_id and x.status='active') then raise exception 'email author user is not in this organization'; end if;
  if new.approval_id is not null and not exists(select 1 from public.approvals x where x.id=new.approval_id and x.organization_id=new.organization_id) then raise exception 'email approval is not in this organization'; end if;
  return new;
end $$;

drop trigger if exists companies_validate_organization on public.companies;
create trigger companies_validate_organization before insert or update of organization_id,owner_user_id on public.companies for each row execute function public.validate_crm_party_organization();
drop trigger if exists contacts_validate_organization on public.contacts;
create trigger contacts_validate_organization before insert or update of company_id,organization_id on public.contacts for each row execute function public.validate_crm_party_organization();
drop trigger if exists leads_validate_organization on public.leads;
create trigger leads_validate_organization before insert or update of company_id,contact_id,assigned_agent_id,organization_id,owner_user_id on public.leads for each row execute function public.validate_crm_party_organization();
drop trigger if exists opportunities_validate_organization on public.opportunities;
create trigger opportunities_validate_organization before insert or update of company_id,primary_contact_id,lead_id,assigned_agent_id,organization_id,owner_user_id on public.opportunities for each row execute function public.validate_crm_party_organization();
drop trigger if exists crm_activities_validate_organization on public.crm_activities;
create trigger crm_activities_validate_organization before insert or update of company_id,contact_id,lead_id,opportunity_id,created_by_user_id,created_by_agent_id,organization_id on public.crm_activities for each row execute function public.validate_crm_activity_organization();
drop trigger if exists email_threads_validate_organization on public.email_threads;
create trigger email_threads_validate_organization before insert or update of company_id,contact_id,lead_id,opportunity_id,organization_id on public.email_threads for each row execute function public.validate_email_thread_organization();
drop trigger if exists email_messages_validate_organization on public.email_messages;
create trigger email_messages_validate_organization before insert or update of thread_id,approval_id,created_by_user_id,created_by_agent_id,organization_id on public.email_messages for each row execute function public.validate_email_message_organization();
