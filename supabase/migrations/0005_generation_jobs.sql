-- Phase 2 Generation. Apply after 0003_campaign_core.sql (and 0004 if used).
-- Org-scoped generation jobs, optional event trail, RLS via is_org_member / can_manage_org.
-- Personal studio — no billing tables.

create type public.generation_provider as enum (
  'openai_image',
  'google_omni',
  'fal_minimax_h3',
  'fal_minimax_h3_max',
  'grok_imagine',
  'auto'
);

create type public.generation_modality as enum ('image', 'video');

create type public.generation_job_status as enum (
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled'
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  created_by uuid references auth.users(id),
  modality public.generation_modality not null,
  provider public.generation_provider not null default 'auto',
  model_name text,
  status public.generation_job_status not null default 'queued',
  prompt text not null check (char_length(prompt) between 1 and 12000),
  negative_prompt text not null default '' check (char_length(negative_prompt) <= 4000),
  settings jsonb not null default '{}'::jsonb,
  reference_asset_ids uuid[] not null default '{}',
  locked_asset_ids uuid[] not null default '{}',
  result_asset_id uuid references public.assets(id) on delete set null,
  error_message text,
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  external_job_id text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.generation_job_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  status public.generation_job_status not null,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index generation_jobs_campaign_status_idx
  on public.generation_jobs(campaign_id, status, created_at desc);
create index generation_jobs_organization_idx
  on public.generation_jobs(organization_id, created_at desc);
create index generation_jobs_status_idx
  on public.generation_jobs(status, created_at desc)
  where status in ('queued', 'running');
create index generation_job_events_job_idx
  on public.generation_job_events(job_id, created_at);

create or replace function public.validate_generation_job_campaign_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.campaigns c
    where c.id = new.campaign_id and c.organization_id = new.organization_id
  ) then
    raise exception 'generation job campaign must belong to the same organization';
  end if;

  if new.result_asset_id is not null and not exists (
    select 1 from public.assets a
    where a.id = new.result_asset_id
      and a.organization_id = new.organization_id
      and a.campaign_id = new.campaign_id
  ) then
    raise exception 'result asset must belong to the same campaign and organization';
  end if;

  if coalesce(array_length(new.reference_asset_ids, 1), 0) > 0 then
    if (
      select count(*) from public.assets a
      where a.id = any(new.reference_asset_ids)
        and a.organization_id = new.organization_id
        and a.campaign_id = new.campaign_id
    ) <> array_length(new.reference_asset_ids, 1) then
      raise exception 'reference assets must belong to the same campaign and organization';
    end if;
  end if;

  if coalesce(array_length(new.locked_asset_ids, 1), 0) > 0 then
    if (
      select count(*) from public.assets a
      where a.id = any(new.locked_asset_ids)
        and a.organization_id = new.organization_id
        and a.campaign_id = new.campaign_id
    ) <> array_length(new.locked_asset_ids, 1) then
      raise exception 'locked assets must belong to the same campaign and organization';
    end if;
  end if;

  return new;
end $$;

create trigger generation_jobs_validate_org
  before insert or update of campaign_id, organization_id, reference_asset_ids, locked_asset_ids, result_asset_id
  on public.generation_jobs
  for each row execute function public.validate_generation_job_campaign_org();

create or replace function public.touch_generation_job_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger generation_jobs_touch_updated
  before update on public.generation_jobs
  for each row execute function public.touch_generation_job_updated_at();

create or replace function public.append_generation_job_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.generation_job_events (job_id, organization_id, status, message, metadata)
    values (
      new.id,
      new.organization_id,
      new.status,
      coalesce(new.error_message, ''),
      jsonb_build_object(
        'provider', new.provider,
        'modality', new.modality,
        'model_name', new.model_name,
        'external_job_id', new.external_job_id
      )
    );
  end if;
  return new;
end $$;

create trigger generation_jobs_append_event
  after insert or update of status on public.generation_jobs
  for each row execute function public.append_generation_job_event();

alter table public.generation_jobs enable row level security;
alter table public.generation_job_events enable row level security;

create policy generation_jobs_read_org on public.generation_jobs for select to authenticated
  using (public.is_org_member(organization_id));
create policy generation_jobs_insert_org on public.generation_jobs for insert to authenticated
  with check (public.can_manage_org(organization_id) and created_by = auth.uid());
create policy generation_jobs_update_org on public.generation_jobs for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy generation_jobs_delete_org on public.generation_jobs for delete to authenticated
  using (public.can_manage_org(organization_id));

create policy generation_job_events_read_org on public.generation_job_events for select to authenticated
  using (public.is_org_member(organization_id));
create policy generation_job_events_insert_org on public.generation_job_events for insert to authenticated
  with check (public.can_manage_org(organization_id));
