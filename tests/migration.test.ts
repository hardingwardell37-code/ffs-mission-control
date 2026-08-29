import { readFileSync } from "node:fs"; import { describe, expect, it } from "vitest";
const sql=readFileSync(new URL("../supabase/migrations/0002_governed_registry.sql",import.meta.url),"utf8");
const skillSql=readFileSync(new URL("../supabase/migrations/0003_marketing_skill_registry.sql",import.meta.url),"utf8");
const crmSql=readFileSync(new URL("../supabase/migrations/0004_crm_email_foundation.sql",import.meta.url),"utf8");
describe("organization isolation migration",()=>{it("removes broad foundation policies",()=>expect(sql).toContain('drop policy if exists "authenticated users manage agents"')); it("scopes every owned table",()=>{for(const table of ["agents","tasks","approvals","audit_events"]) expect(sql).toContain(`alter table public.${table} add column organization_id`)}); it("prevents audit updates and deletes",()=>expect(sql).toContain("audit_events_no_update_delete"));});
describe("governed skill registry migration",()=>{
  it("adds organization-scoped skills and assignments",()=>{expect(skillSql).toContain("create table if not exists public.skills");expect(skillSql).toContain("create table if not exists public.agent_skills");});
  it("enforces cross-organization assignment integrity",()=>expect(skillSql).toContain("agent_skills_validate_organization"));
  it("reuses the existing authorization functions",()=>{expect(skillSql).toContain("public.is_org_member(organization_id)");expect(skillSql).toContain("public.can_manage_org(organization_id)");});
  it("bootstraps without duplicate agents, skills, or mappings",()=>{expect(skillSql).toContain("on conflict (organization_id, slug) where archived_at is null do update");expect(skillSql).toContain("on conflict (agent_id,skill_id) do nothing");});
});
describe("CRM and email foundation migration",()=>{
  it("adds every organization-owned CRM table",()=>{for(const table of ["companies","contacts","leads","opportunities","crm_activities","email_threads","email_messages"])expect(crmSql).toContain(`create table if not exists public.${table}`);});
  it("enables RLS and reuses organization authorization",()=>{expect(crmSql).toContain("public.is_org_member(organization_id)");expect(crmSql).toContain("public.can_manage_org(organization_id)");});
  it("guards cross-organization CRM and email relationships",()=>{for(const trigger of ["contacts_validate_organization","leads_validate_organization","opportunities_validate_organization","email_threads_validate_organization","email_messages_validate_organization"])expect(crmSql).toContain(trigger);});
  it("provides the optional approval seam without delivery logic",()=>{expect(crmSql).toContain("approval_id uuid references public.approvals(id)");expect(crmSql).not.toContain("access_token");});
});
