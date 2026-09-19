import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql0002 = readFileSync(
  new URL("../supabase/migrations/0002_governed_registry.sql", import.meta.url),
  "utf8",
);
const sql0004 = readFileSync(
  new URL("../supabase/migrations/0004_studio_bootstrap.sql", import.meta.url),
  "utf8",
);

describe("organization isolation migration", () => {
  it("removes broad foundation policies", () =>
    expect(sql0002).toContain('drop policy if exists "authenticated users manage agents"'));
  it("scopes every owned table", () => {
    for (const table of ["agents", "tasks", "approvals", "audit_events"]) {
      expect(sql0002).toContain(`alter table public.${table} add column organization_id`);
    }
  });
  it("prevents audit updates and deletes", () =>
    expect(sql0002).toContain("audit_events_no_update_delete"));
});

describe("studio bootstrap migration", () => {
  it("defines ensure_studio_access as security definer", () => {
    expect(sql0004).toContain("create or replace function public.ensure_studio_access()");
    expect(sql0004).toMatch(/security definer/i);
  });
  it("grants execute only to authenticated", () => {
    expect(sql0004).toContain("grant execute on function public.ensure_studio_access() to authenticated");
    expect(sql0004).toContain("revoke all on function public.ensure_studio_access() from public");
  });
  it("does not add anon insert policies for orgs or memberships", () => {
    expect(sql0004.toLowerCase()).not.toContain("to anon");
    expect(sql0004).not.toMatch(/create policy[\s\S]*insert[\s\S]*organizations/i);
    expect(sql0004).not.toMatch(/create policy[\s\S]*insert[\s\S]*organization_memberships/i);
  });
  it("bootstraps F&P Studio org slug prefix", () => {
    expect(sql0004).toContain("F&P Studio");
    expect(sql0004).toContain("fp-studio-");
  });
});
