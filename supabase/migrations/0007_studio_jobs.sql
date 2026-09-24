-- Job Operator Phase 0. Apply after 0005_generation_jobs.sql (and 0006 if used).
-- Marketplace-agnostic intake → qualify → price → approve data model.
-- No Higgsfield. No marketplace scrape/auto-apply. Personal studio — no billing tables.
-- Known approval action_key vocabulary (approvals.action_key remains text):
-- job_workflow | job_budget | job_rights | job_delivery

create type public.studio_job_source as enum (
  'upwork',
  'fiverr',
  'contra',
  'email',
  'intake',
  'other'
);

create type public.studio_job_status as enum (
  'new',
  'needs_review',
  'approved',
  'generating',
  'qa',
  'delivered',
  'rejected'
);

create type public.studio_job_decision as enum (
  'accept',
  'review',
  'reject'
);

create type public.job_workflow_approval_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'rejected'
);

create type public.job_revision_approval_status as enum (
  'draft',
  'pending_approval',
  'approved',
  'rejected'
);

create table public.studio_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  created_by uuid references auth.users(id),
  title text not null check (char_length(title) between 1 and 200),
  source public.studio_job_source not null default 'other',
  raw_brief text not null check (char_length(raw_brief) between 1 and 50000),
  client_notes text not null default '' check (char_length(client_notes) <= 20000),
  client_budget_cents integer check (client_budget_cents is null or client_budget_cents >= 0),
  quoted_price_cents integer check (quoted_price_cents is null or quoted_price_cents >= 0),
  max_production_budget_cents integer check (max_production_budget_cents is null or max_production_budget_cents >= 0),
  channel_fee_bps integer not null default 0 check (channel_fee_bps between 0 and 10000),
  contingency_bps integer not null default 1000 check (contingency_bps between 0 and 10000),
  deadline timestamptz,
  status public.studio_job_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brief_analyses (
  id uuid primary key default gen_random_uuid(),
  studio_job_id uuid not null references public.studio_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  deliverables jsonb not null default '[]'::jsonb,
  dimensions jsonb not null default '[]'::jsonb,
  durations jsonb not null default '[]'::jsonb,
  "references" jsonb not null default '[]'::jsonb,
  exact_text jsonb not null default '[]'::jsonb,
  brand_constraints jsonb not null default '[]'::jsonb,
  rights_concerns jsonb not null default '[]'::jsonb,
  missing_information jsonb not null default '[]'::jsonb,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  decision public.studio_job_decision not null default 'review',
  rationale text not null default '' check (char_length(rationale) <= 8000),
  model_used text not null default 'mock' check (char_length(model_used) between 1 and 120),
  analysis_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (studio_job_id)
);

create table public.job_workflows (
  id uuid primary key default gen_random_uuid(),
  studio_job_id uuid not null references public.studio_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  steps jsonb not null default '[]'::jsonb,
  estimated_total_cost_cents integer check (estimated_total_cost_cents is null or estimated_total_cost_cents >= 0),
  approval_status public.job_workflow_approval_status not null default 'draft',
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (studio_job_id)
);

create table public.job_revisions (
  id uuid primary key default gen_random_uuid(),
  studio_job_id uuid not null references public.studio_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_note text not null check (char_length(client_note) between 1 and 8000),
  affected_deliverable text not null default '' check (char_length(affected_deliverable) <= 400),
  recommended_action text not null default '' check (char_length(recommended_action) <= 4000),
  expected_incremental_cost_cents integer check (
    expected_incremental_cost_cents is null or expected_incremental_cost_cents >= 0
  ),
  approval_status public.job_revision_approval_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.generation_jobs
  add column studio_job_id uuid references public.studio_jobs(id) on delete set null;

create index studio_jobs_org_status_created_idx
  on public.studio_jobs(organization_id, status, created_at desc);
create index studio_jobs_campaign_idx
  on public.studio_jobs(campaign_id)
  where campaign_id is not null;
create index brief_analyses_organization_idx
  on public.brief_analyses(organization_id, created_at desc);
create index job_workflows_organization_idx
  on public.job_workflows(organization_id, created_at desc);
create index job_revisions_job_idx
  on public.job_revisions(studio_job_id, created_at desc);
create index job_revisions_organization_idx
  on public.job_revisions(organization_id, created_at desc);
create index generation_jobs_studio_job_idx
  on public.generation_jobs(studio_job_id)
  where studio_job_id is not null;

create or replace function public.validate_studio_job_campaign_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.campaign_id is not null and not exists (
    select 1 from public.campaigns c
    where c.id = new.campaign_id and c.organization_id = new.organization_id
  ) then
    raise exception 'studio job campaign must belong to the same organization';
  end if;
  return new;
end $$;

create trigger studio_jobs_validate_campaign_org
  before insert or update of campaign_id, organization_id
  on public.studio_jobs
  for each row execute function public.validate_studio_job_campaign_org();

create or replace function public.touch_studio_job_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger studio_jobs_touch_updated
  before update on public.studio_jobs
  for each row execute function public.touch_studio_job_updated_at();

create or replace function public.validate_brief_analysis_job_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.studio_jobs j
    where j.id = new.studio_job_id and j.organization_id = new.organization_id
  ) then
    raise exception 'brief analysis studio job must belong to the same organization';
  end if;
  return new;
end $$;

create trigger brief_analyses_validate_org
  before insert or update of studio_job_id, organization_id
  on public.brief_analyses
  for each row execute function public.validate_brief_analysis_job_org();

create or replace function public.validate_job_workflow_job_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.studio_jobs j
    where j.id = new.studio_job_id and j.organization_id = new.organization_id
  ) then
    raise exception 'job workflow studio job must belong to the same organization';
  end if;
  return new;
end $$;

create trigger job_workflows_validate_org
  before insert or update of studio_job_id, organization_id
  on public.job_workflows
  for each row execute function public.validate_job_workflow_job_org();

create or replace function public.touch_job_workflow_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger job_workflows_touch_updated
  before update on public.job_workflows
  for each row execute function public.touch_job_workflow_updated_at();

create or replace function public.validate_job_revision_job_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.studio_jobs j
    where j.id = new.studio_job_id and j.organization_id = new.organization_id
  ) then
    raise exception 'job revision studio job must belong to the same organization';
  end if;
  return new;
end $$;

create trigger job_revisions_validate_org
  before insert or update of studio_job_id, organization_id
  on public.job_revisions
  for each row execute function public.validate_job_revision_job_org();

create or replace function public.touch_job_revision_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger job_revisions_touch_updated
  before update on public.job_revisions
  for each row execute function public.touch_job_revision_updated_at();

create or replace function public.validate_generation_job_studio_job_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.studio_job_id is not null and not exists (
    select 1 from public.studio_jobs j
    where j.id = new.studio_job_id and j.organization_id = new.organization_id
  ) then
    raise exception 'generation job studio_job must belong to the same organization';
  end if;
  return new;
end $$;

create trigger generation_jobs_validate_studio_job_org
  before insert or update of studio_job_id, organization_id
  on public.generation_jobs
  for each row execute function public.validate_generation_job_studio_job_org();

alter table public.studio_jobs enable row level security;
alter table public.brief_analyses enable row level security;
alter table public.job_workflows enable row level security;
alter table public.job_revisions enable row level security;

create policy studio_jobs_read_org on public.studio_jobs for select to authenticated
  using (public.is_org_member(organization_id));
create policy studio_jobs_insert_org on public.studio_jobs for insert to authenticated
  with check (public.can_manage_org(organization_id) and created_by = auth.uid());
create policy studio_jobs_update_org on public.studio_jobs for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy studio_jobs_delete_org on public.studio_jobs for delete to authenticated
  using (public.can_manage_org(organization_id));

create policy brief_analyses_read_org on public.brief_analyses for select to authenticated
  using (public.is_org_member(organization_id));
create policy brief_analyses_insert_org on public.brief_analyses for insert to authenticated
  with check (public.can_manage_org(organization_id));
create policy brief_analyses_update_org on public.brief_analyses for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy brief_analyses_delete_org on public.brief_analyses for delete to authenticated
  using (public.can_manage_org(organization_id));

create policy job_workflows_read_org on public.job_workflows for select to authenticated
  using (public.is_org_member(organization_id));
create policy job_workflows_insert_org on public.job_workflows for insert to authenticated
  with check (public.can_manage_org(organization_id));
create policy job_workflows_update_org on public.job_workflows for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy job_workflows_delete_org on public.job_workflows for delete to authenticated
  using (public.can_manage_org(organization_id));

create policy job_revisions_read_org on public.job_revisions for select to authenticated
  using (public.is_org_member(organization_id));
create policy job_revisions_insert_org on public.job_revisions for insert to authenticated
  with check (public.can_manage_org(organization_id));
create policy job_revisions_update_org on public.job_revisions for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy job_revisions_delete_org on public.job_revisions for delete to authenticated
  using (public.can_manage_org(organization_id));
