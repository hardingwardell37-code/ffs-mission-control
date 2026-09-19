import { readFileSync } from "node:fs"; import { describe, expect, it } from "vitest";
const sql2=readFileSync(new URL("../supabase/migrations/0002_governed_registry.sql",import.meta.url),"utf8");
const sql3=readFileSync(new URL("../supabase/migrations/0003_campaign_core.sql",import.meta.url),"utf8");
describe("organization isolation migration",()=>{it("removes broad foundation policies",()=>expect(sql2).toContain('drop policy if exists "authenticated users manage agents"')); it("scopes every owned table",()=>{for(const table of ["agents","tasks","approvals","audit_events"]) expect(sql2).toContain(`alter table public.${table} add column organization_id`)}); it("prevents audit updates and deletes",()=>expect(sql2).toContain("audit_events_no_update_delete"));});
describe("campaign core migration",()=>{
  it("creates campaign and asset tables",()=>{for(const table of ["campaigns","campaign_dna","campaign_sections","research_sources","assets"]) expect(sql3).toContain(`create table public.${table}`);});
  it("reuses org membership helpers for RLS",()=>{expect(sql3).toContain("is_org_member"); expect(sql3).toContain("can_manage_org"); expect(sql3).toContain("campaigns_read_org"); expect(sql3).toContain("assets_insert_org");});
  it("seeds campaign sections and dna on insert",()=>expect(sql3).toContain("seed_campaign_sections"));
  it("documents campaign-assets storage bucket",()=>expect(sql3).toContain("campaign-assets"));
  it("includes originality and provenance columns",()=>{expect(sql3).toContain("original_direction"); expect(sql3).toContain("ownership_status"); expect(sql3).toContain("parent_asset_id"); expect(sql3).toContain("reference_asset_ids");});
});
