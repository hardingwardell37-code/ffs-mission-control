import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql0002 = readFileSync(
  new URL("../supabase/migrations/0002_governed_registry.sql", import.meta.url),
  "utf8",
);
const sql0003 = readFileSync(
  new URL("../supabase/migrations/0003_campaign_core.sql", import.meta.url),
  "utf8",
);
const sql0004 = readFileSync(
  new URL("../supabase/migrations/0004_studio_bootstrap.sql", import.meta.url),
  "utf8",
);

describe("organization isolation migration", () => {
  it("removes broad foundation policies", () =>
    expect(sql0002).toContain('drop policy if exists "authenticated users read agents"'));
  it("scopes every owned table", () => {
    for (const table of ["agents", "tasks", "approvals", "audit_events"]) {
      expect(sql0002).toContain(`alter table public.${table} add column organization_id`);
    }
  });
  it("defines org membership helpers", () => {
    expect(sql0002).toContain("create or replace function public.is_org_member");
    expect(sql0002).toContain("create or replace function public.can_manage_org");
  });
});

describe("campaign core migration", () => {
  it("creates campaign and asset tables", () => {
    for (const table of ["campaigns", "campaign_dna", "campaign_sections", "research_sources", "assets"]) {
      expect(sql0003).toContain(`create table public.${table}`);
    }
  });
  it("reuses org membership helpers for RLS", () => {
    expect(sql0003).toContain("is_org_member");
    expect(sql0003).toContain("campaigns");
  });
  it("seeds campaign sections on insert", () => expect(sql0003).toContain("seed_campaign_sections"));
  it("documents campaign-assets storage bucket", () => expect(sql0003).toContain("campaign-assets"));
  it("includes originality and provenance columns", () => {
    expect(sql0003).toContain("originality_policy");
    expect(sql0003).toContain("original_direction");
    expect(sql0003).toContain("ownership_status");
  });
});

describe("studio bootstrap migration", () => {
  it("defines ensure_studio_access as security definer", () => {
    expect(sql0004).toContain("create or replace function public.ensure_studio_access()");
    expect(sql0004).toMatch(/security definer/i);
  });
  it("grants execute to authenticated", () => {
    expect(sql0004).toContain("grant execute on function public.ensure_studio_access() to authenticated");
  });
  it("does not add anon insert policies for orgs or memberships", () => {
    expect(sql0004.toLowerCase()).not.toContain("to anon");
  });
  it("bootstraps F&P Studio org slug prefix", () => {
    expect(sql0004).toContain("F&P Studio");
    expect(sql0004).toContain("fp-studio-");
  });
});
