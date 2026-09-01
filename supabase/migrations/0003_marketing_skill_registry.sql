-- Governed skill registry and idempotent FFS Marketing Department bootstrap.

alter table public.agents add column if not exists department text;

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  category text,
  description text not null default '',
  source_name text not null,
  source_url text not null,
  source_version text,
  instruction_reference text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index if not exists skills_organization_slug_key
  on public.skills(organization_id, slug) where archived_at is null;
create index if not exists skills_organization_status_idx
  on public.skills(organization_id, status, name);

create table if not exists public.agent_skills (
  agent_id uuid not null references public.agents(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  primary key (agent_id, skill_id)
);

create index if not exists agent_skills_organization_idx
  on public.agent_skills(organization_id, agent_id);

alter table public.skills enable row level security;
alter table public.agent_skills enable row level security;

drop policy if exists skills_read_org on public.skills;
drop policy if exists skills_insert_org on public.skills;
drop policy if exists skills_update_org on public.skills;
drop policy if exists skills_delete_org on public.skills;
drop policy if exists agent_skills_read_org on public.agent_skills;
drop policy if exists agent_skills_manage_org on public.agent_skills;

create policy skills_read_org on public.skills for select to authenticated
  using (public.is_org_member(organization_id));
create policy skills_insert_org on public.skills for insert to authenticated
  with check (public.can_manage_org(organization_id) and created_by = auth.uid());
create policy skills_update_org on public.skills for update to authenticated
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id));
create policy skills_delete_org on public.skills for delete to authenticated
  using (public.can_manage_org(organization_id));
create policy agent_skills_read_org on public.agent_skills for select to authenticated
  using (public.is_org_member(organization_id));
create policy agent_skills_manage_org on public.agent_skills for all to authenticated
  using (public.can_manage_org(organization_id))
  with check (public.can_manage_org(organization_id) and assigned_by = auth.uid());

create or replace function public.validate_agent_skill_organization()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.agents a
    join public.skills s on s.id = new.skill_id
    where a.id = new.agent_id
      and a.organization_id = new.organization_id
      and s.organization_id = new.organization_id
      and a.archived_at is null
      and s.archived_at is null
  ) then
    raise exception 'agent and skill must be active records in the same organization';
  end if;
  return new;
end $$;

drop trigger if exists agent_skills_validate_organization on public.agent_skills;
create trigger agent_skills_validate_organization
  before insert or update of agent_id, skill_id, organization_id on public.agent_skills
  for each row execute function public.validate_agent_skill_organization();

do $$
declare
  v_org uuid;
  v_owner uuid;
  v_source constant text := 'https://marketing-skills.com/';
  v_boundaries constant text := 'Internal research, analysis, recommendations, drafts, plans, briefs, and performance analysis only. Human approval is required before external communications, publishing, website deployment, advertising, spend changes, purchases, pricing or discount changes, contracts, production deletion, or any irreversible external action. No autonomous execution.';
begin
  select id into v_org from public.organizations where slug = 'forged-field-systems';
  if v_org is null then raise exception 'Forged Field Systems organization not found'; end if;
  select user_id into v_owner from public.organization_memberships
    where organization_id = v_org and status = 'active' and role in ('owner','admin')
    order by case role when 'owner' then 0 else 1 end, created_at limit 1;
  if v_owner is null then raise exception 'Forged Field Systems active owner/admin not found'; end if;

  insert into public.skills (organization_id,name,slug,category,description,source_name,source_url,instruction_reference,status,created_by)
  values
    (v_org,'Product Marketing','product-marketing','Strategy','Foundational product, audience, positioning, and messaging context.','Marketing Skills',v_source,'skills/product-marketing/SKILL.md','active',v_owner),
    (v_org,'Customer Research','customer-research','Research','Conduct and synthesize customer and audience research.','Marketing Skills',v_source,'skills/customer-research/SKILL.md','active',v_owner),
    (v_org,'Competitor Profiling','competitor-profiling','Research','Research and profile competitors from evidence.','Marketing Skills',v_source,'skills/competitor-profiling/SKILL.md','active',v_owner),
    (v_org,'Marketing Plan','marketing-plan','Strategy','Create evidence-based marketing plans and priorities.','Marketing Skills',v_source,'skills/marketing-plan/SKILL.md','active',v_owner),
    (v_org,'Marketing Ideas','marketing-ideas','Growth','Evaluate relevant marketing strategies and tactics.','Marketing Skills',v_source,'skills/marketing-ideas/SKILL.md','active',v_owner),
    (v_org,'Content Strategy','content-strategy','Content','Plan content systems, topics, and editorial direction.','Marketing Skills',v_source,'skills/content-strategy/SKILL.md','active',v_owner),
    (v_org,'SEO Audit','seo-audit','SEO','Audit technical and on-page search performance.','Marketing Skills',v_source,'skills/seo-audit/SKILL.md','active',v_owner),
    (v_org,'AI SEO','ai-seo','SEO','Optimize visibility in AI-generated search and answers.','Marketing Skills',v_source,'skills/ai-seo/SKILL.md','active',v_owner),
    (v_org,'Programmatic SEO','programmatic-seo','SEO','Plan scalable, data-driven SEO page systems.','Marketing Skills',v_source,'skills/programmatic-seo/SKILL.md','active',v_owner),
    (v_org,'Schema','schema','SEO','Plan and validate structured-data markup.','Marketing Skills',v_source,'skills/schema/SKILL.md','active',v_owner),
    (v_org,'Site Architecture','site-architecture','SEO','Design page hierarchy, navigation, URLs, and internal linking.','Marketing Skills',v_source,'skills/site-architecture/SKILL.md','active',v_owner),
    (v_org,'Conversion Rate Optimization','cro','Conversion','Analyze and improve marketing pages and forms for conversion.','Marketing Skills',v_source,'skills/cro/SKILL.md','active',v_owner),
    (v_org,'Offers','offers','Conversion','Design and improve offer structure and value framing.','Marketing Skills',v_source,'skills/offers/SKILL.md','active',v_owner),
    (v_org,'Copywriting','copywriting','Copywriting','Write and improve marketing page and campaign copy.','Marketing Skills',v_source,'skills/copywriting/SKILL.md','active',v_owner),
    (v_org,'Copy Editing','copy-editing','Copywriting','Review and refine existing marketing copy.','Marketing Skills',v_source,'skills/copy-editing/SKILL.md','active',v_owner),
    (v_org,'Paid Ads','ads','Paid Media','Plan paid advertising strategy, targeting, and optimization.','Marketing Skills',v_source,'skills/ads/SKILL.md','active',v_owner),
    (v_org,'Ad Creative','ad-creative','Paid Media','Plan and iterate governed advertising creative.','Marketing Skills',v_source,'skills/ad-creative/SKILL.md','active',v_owner),
    (v_org,'Emails','emails','Lifecycle','Design lifecycle email sequences and flows without sending them.','Marketing Skills',v_source,'skills/emails/SKILL.md','active',v_owner),
    (v_org,'Analytics','analytics','Analytics','Plan and audit analytics tracking and measurement.','Marketing Skills',v_source,'skills/analytics/SKILL.md','active',v_owner),
    (v_org,'Attribution','attribution','Analytics','Evaluate marketing attribution and causal contribution.','Marketing Skills',v_source,'skills/attribution/SKILL.md','active',v_owner),
    (v_org,'A/B Testing','ab-testing','Growth','Design measurable experiments and testing programs.','Marketing Skills',v_source,'skills/ab-testing/SKILL.md','active',v_owner)
  on conflict (organization_id, slug) where archived_at is null do update set
    name=excluded.name, category=excluded.category, description=excluded.description,
    source_name=excluded.source_name, source_url=excluded.source_url,
    instruction_reference=excluded.instruction_reference, status='active', updated_at=now();

  insert into public.agents (organization_id,name,slug,department,purpose,description,status,model_provider,model_name,system_instructions,max_runtime_seconds,created_by)
  values
    (v_org,'Marketing Chief of Staff','marketing-chief-of-staff','Marketing','Orchestrate marketing objectives, delegate specialist work, manage dependencies, assemble campaign outputs, and escalate approval-gated actions.','Coordinates the Marketing Department without replacing specialist judgment.','draft','openai','unconfigured','Coordinate specialist planning and preserve original objectives. '||v_boundaries,300,v_owner),
    (v_org,'Market Intelligence Agent','market-intelligence','Marketing','Research markets, customers, competitors, demand, positioning, objections, and commercial opportunities.','Evidence-led market and audience intelligence.','draft','openai','unconfigured','Separate evidence from inference and cite research inputs. '||v_boundaries,300,v_owner),
    (v_org,'SEO Director','seo-director','Marketing','Own organic search strategy, technical SEO analysis, search architecture, structured data, and AI-search visibility.','Organic search governance and analysis.','draft','openai','unconfigured','Produce diagnostic findings and implementation recommendations only. '||v_boundaries,300,v_owner),
    (v_org,'Content Strategist','content-strategist','Marketing','Design evidence-based content systems, editorial plans, topic structures, and organic content strategy.','Editorial systems and content strategy.','draft','openai','unconfigured','Create internal plans and drafts grounded in approved positioning. '||v_boundaries,300,v_owner),
    (v_org,'Conversion Director','conversion-director','Marketing','Improve conversion paths, landing pages, funnels, forms, offers, and customer decision flow.','Conversion analysis and governed experimentation.','draft','openai','unconfigured','Recommend and draft conversion changes; do not deploy them. '||v_boundaries,300,v_owner),
    (v_org,'Copy Chief','copy-chief','Marketing','Create and refine marketing copy while maintaining positioning, offer clarity, brand consistency, and campaign intent.','Marketing copy direction and review.','draft','openai','unconfigured','Create internal copy drafts and revisions only. '||v_boundaries,300,v_owner),
    (v_org,'Paid Acquisition Agent','paid-acquisition','Marketing','Develop paid-media strategies, campaign structures, testing plans, targeting approaches, and creative requirements.','Paid acquisition planning with no spend authority.','draft','openai','unconfigured','Never publish campaigns, change spend, or purchase media. '||v_boundaries,300,v_owner),
    (v_org,'Lifecycle Agent','lifecycle-agent','Marketing','Design lead nurture, customer lifecycle, follow-up, retention, and email communication strategy.','Lifecycle strategy with no external sending authority.','draft','openai','unconfigured','Create internal lifecycle plans and drafts; never send email. '||v_boundaries,300,v_owner),
    (v_org,'Growth Engineer','growth-engineer','Marketing','Design measurable growth experiments, tracking approaches, attribution logic, and optimization loops.','Measurement-led growth experimentation.','draft','openai','unconfigured','Design experiments and measurement plans without autonomous execution. '||v_boundaries,300,v_owner),
    (v_org,'Creative Director','creative-director','Marketing','Translate approved strategy into coherent creative direction for advertisements, images, videos, landing pages, and campaigns.','Creative planning without generation or publishing integrations.','draft','openai','unconfigured','Produce internal creative direction and briefs only. '||v_boundaries,300,v_owner),
    (v_org,'Marketing Analyst','marketing-analyst','Marketing','Evaluate campaign and funnel performance, identify causal patterns, compare outcomes, and produce actionable findings.','Marketing performance analysis.','draft','openai','unconfigured','Analyze supplied data; distinguish correlation from causation. '||v_boundaries,300,v_owner),
    (v_org,'Independent Marketing Reviewer','independent-marketing-reviewer','Marketing','Adversarially review marketing outputs against objectives, evidence, skill procedure, brand requirements, and approval boundaries.','Independent review; owns no campaign execution.','draft','openai','unconfigured','Review independently and flag unsupported claims or boundary violations. '||v_boundaries,300,v_owner)
  on conflict (organization_id, slug) where archived_at is null do update set
    name=excluded.name, department=excluded.department, purpose=excluded.purpose,
    description=excluded.description, system_instructions=excluded.system_instructions, updated_at=now();

  insert into public.agent_skills (agent_id,skill_id,organization_id,assigned_by)
  select a.id,s.id,v_org,v_owner from (values
    ('marketing-chief-of-staff','product-marketing'),('marketing-chief-of-staff','marketing-plan'),('marketing-chief-of-staff','customer-research'),('marketing-chief-of-staff','analytics'),
    ('market-intelligence','customer-research'),('market-intelligence','competitor-profiling'),('market-intelligence','product-marketing'),
    ('seo-director','seo-audit'),('seo-director','ai-seo'),('seo-director','programmatic-seo'),('seo-director','schema'),('seo-director','site-architecture'),
    ('content-strategist','content-strategy'),('content-strategist','customer-research'),('content-strategist','seo-audit'),('content-strategist','product-marketing'),
    ('conversion-director','cro'),('conversion-director','offers'),('conversion-director','customer-research'),('conversion-director','ab-testing'),
    ('copy-chief','copywriting'),('copy-chief','copy-editing'),('copy-chief','product-marketing'),('copy-chief','offers'),('copy-chief','ad-creative'),
    ('paid-acquisition','ads'),('paid-acquisition','ad-creative'),('paid-acquisition','ab-testing'),('paid-acquisition','analytics'),
    ('lifecycle-agent','emails'),('lifecycle-agent','customer-research'),('lifecycle-agent','analytics'),
    ('growth-engineer','ab-testing'),('growth-engineer','analytics'),('growth-engineer','attribution'),('growth-engineer','marketing-ideas'),
    ('creative-director','product-marketing'),('creative-director','copywriting'),('creative-director','ad-creative'),('creative-director','marketing-plan'),
    ('marketing-analyst','analytics'),('marketing-analyst','attribution'),('marketing-analyst','ab-testing'),
    ('independent-marketing-reviewer','product-marketing'),('independent-marketing-reviewer','marketing-plan'),('independent-marketing-reviewer','copy-editing')
  ) as assignment(agent_slug,skill_slug)
  join public.agents a on a.organization_id=v_org and a.slug=assignment.agent_slug and a.archived_at is null
  join public.skills s on s.organization_id=v_org and s.slug=assignment.skill_slug and s.archived_at is null
  on conflict (agent_id,skill_id) do nothing;
end $$;
