-- Phase 1 Campaign Core. Apply after 0002_governed_registry.sql.
-- Org-scoped campaigns, DNA, research sources, assets with provenance. No generation providers.

create type public.campaign_status as enum ('draft','active','paused','archived');
create type public.campaign_entry_mode as enum ('research','product_url','upload','hybrid');
create type public.campaign_section as enum (
  'brief','research','dna','references','uploaded_assets','concepts','storyboards',
  'generated_images','generated_video','audio','timeline','motion','vfx','color',
  'review','masters','exports'
);
create type public.asset_role as enum ('source','reference','locked','generated');
create type public.asset_ownership as enum ('owned','licensed','generated','unknown');
create type public.asset_approval_state as enum ('draft','pending','approved','rejected','locked');

-- Known approval action_key vocabulary for campaign gates (approvals.action_key remains text).
-- campaign_concept | campaign_storyboard | campaign_assets | campaign_editorial | campaign_final_master | campaign_export

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.campaign_status not null default 'draft',
  entry_mode public.campaign_entry_mode not null default 'research',
  brief text not null default '',
  product_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create table public.campaign_dna (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  positioning text not null default '',
  audience text not null default '',
  tone text not null default '',
  visual_direction text not null default '',
  do_not_copy_notes text not null default '',
  originality_policy text not null default 'Research inspires direction only. Never copy source wording, imagery, footage, or protected creative execution into final work.',
  extras jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.campaign_sections (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  section_key public.campaign_section not null,
  label text not null,
  sort_order integer not null default 0,
  unique (campaign_id, section_key)
);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  url text not null check (char_length(url) between 1 and 2000),
  title text not null default '',
  notes text not null default '',
  observation text not null default '',
  original_direction text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  role public.asset_role not null default 'source',
  section public.campaign_section,
  mime_type text,
  storage_path text,
  storage_url text,
  file_size bigint check (file_size is null or file_size >= 0),
  ownership_status public.asset_ownership not null default 'unknown',
  source_url text,
  origin text not null default 'upload' check (origin in ('upload','url','generated','import')),
  parent_asset_id uuid references public.assets(id) on delete set null,
  approval_state public.asset_approval_state not null default 'draft',
  model_provider text,
  model_name text,
  prompt text,
  generation_settings jsonb not null default '{}'::jsonb,
  reference_asset_ids uuid[] not null default '{}',
  usage_notes text not null default '',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaigns_organization_status_idx on public.campaigns(organization_id, status, updated_at desc);
create index campaign_dna_organization_idx on public.campaign_dna(organization_id);
create index campaign_sections_campaign_idx on public.campaign_sections(campaign_id, sort_order);
create index research_sources_campaign_idx on public.research_sources(campaign_id, created_at desc);
create index assets_campaign_role_idx on public.assets(campaign_id, role, created_at desc);
create index assets_organization_idx on public.assets(organization_id, created_at desc);
create index assets_parent_idx on public.assets(parent_asset_id) where parent_asset_id is not null;

create or replace function public.seed_campaign_sections()
returns trigger language plpgsql set search_path = '' as $$
declare
  keys public.campaign_section[] := array[
    'brief','research','dna','references','uploaded_assets','concepts','storyboards',
    'generated_images','generated_video','audio','timeline','motion','vfx','color',
    'review','masters','exports'
  ]::public.campaign_section[];
  labels text[] := array[
    'Brief','Research','Campaign DNA','References','Uploaded Assets','Concepts','Storyboards & Previs',
    'Generated Images','Generated Video','Audio','Timeline / Edit','Motion Graphics','VFX','Color / Finishing',
    'Review & QC','Approved Masters','Exports'
  ];
  i integer;
begin
  for i in 1..array_length(keys, 1) loop
    insert into public.campaign_sections (campaign_id, organization_id, section_key, label, sort_order)
    values (new.id, new.organization_id, keys[i], labels[i], i);
  end loop;
  insert into public.campaign_dna (campaign_id, organization_id)
  values (new.id, new.organization_id);
  return new;
end $$;

create trigger campaigns_seed_structure
  after insert on public.campaigns
  for each row execute function public.seed_campaign_sections();

create or replace function public.validate_asset_campaign_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.campaigns c
    where c.id = new.campaign_id and c.organization_id = new.organization_id
  ) then
    raise exception 'asset campaign must belong to the same organization';
  end if;
  if new.parent_asset_id is not null and not exists (
    select 1 from public.assets a
    where a.id = new.parent_asset_id and a.organization_id = new.organization_id and a.campaign_id = new.campaign_id
  ) then
    raise exception 'parent asset must belong to the same campaign and organization';
  end if;
  return new;
end $$;

create trigger assets_validate_org
  before insert or update of campaign_id, organization_id, parent_asset_id on public.assets
  for each row execute function public.validate_asset_campaign_org();

create or replace function public.validate_research_campaign_org()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.campaigns c
    where c.id = new.campaign_id and c.organization_id = new.organization_id
  ) then
    raise exception 'research source campaign must belong to the same organization';
  end if;
  return new;
end $$;

create trigger research_validate_org
  before insert or update of campaign_id, organization_id on public.research_sources
  for each row execute function public.validate_research_campaign_org();

create or replace function public.touch_campaign_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger campaigns_touch_updated
  before update on public.campaigns
  for each row execute function public.touch_campaign_updated_at();

alter table public.campaigns enable row level security;
alter table public.campaign_dna enable row level security;
alter table public.campaign_sections enable row level security;
alter table public.research_sources enable row level security;
alter table public.assets enable row level security;

create policy campaigns_read_org on public.campaigns for select to authenticated
  using (public.is_org_member(organization_id));
create policy campaigns_insert_org on public.campaigns for insert to authenticated
  with check (public.can_manage_org(organization_id) and created_by = auth.uid());
create policy campaigns_update_org on public.campaigns for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy campaigns_delete_org on public.campaigns for delete to authenticated
  using (public.can_manage_org(organization_id));

create policy campaign_dna_read_org on public.campaign_dna for select to authenticated
  using (public.is_org_member(organization_id));
create policy campaign_dna_update_org on public.campaign_dna for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy campaign_dna_insert_org on public.campaign_dna for insert to authenticated
  with check (public.can_manage_org(organization_id));

create policy campaign_sections_read_org on public.campaign_sections for select to authenticated
  using (public.is_org_member(organization_id));
create policy campaign_sections_manage_org on public.campaign_sections for all to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));

create policy research_sources_read_org on public.research_sources for select to authenticated
  using (public.is_org_member(organization_id));
create policy research_sources_insert_org on public.research_sources for insert to authenticated
  with check (public.can_manage_org(organization_id) and created_by = auth.uid());
create policy research_sources_update_org on public.research_sources for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy research_sources_delete_org on public.research_sources for delete to authenticated
  using (public.can_manage_org(organization_id));

create policy assets_read_org on public.assets for select to authenticated
  using (public.is_org_member(organization_id));
create policy assets_insert_org on public.assets for insert to authenticated
  with check (public.can_manage_org(organization_id) and created_by = auth.uid());
create policy assets_update_org on public.assets for update to authenticated
  using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id));
create policy assets_delete_org on public.assets for delete to authenticated
  using (public.can_manage_org(organization_id));

-- Storage: create a private bucket named campaign-assets in the Supabase dashboard
-- (or via storage API). Recommended policies: authenticated org members may
-- read/write objects under {organization_id}/{campaign_id}/… paths.
-- App code stores storage_path + optional public/signed storage_url on assets.
