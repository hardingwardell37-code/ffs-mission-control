import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/0005_task_runtime_foundation.sql", "utf8");

describe("task runtime migration", () => {
  it("records each transition atomically with an audit event", () => {
    expect(sql).toContain("create or replace function public.transition_task_runtime");
    expect(sql).toContain("insert into public.audit_events");
    expect(sql).toContain("'task.completed'");
  });
  it("halts approval-gated completion", () => {
    expect(sql).toContain("task approval is unresolved");
    expect(sql).toContain("'approved'=any(v_approval_statuses)");
  });
  it("records a governed agent handoff without a new table", () => {
    expect(sql).toContain("create or replace function public.record_task_runtime_handoff");
    expect(sql).toContain("'task.handoff'");
    expect(sql).toContain("'destinationAgentId'");
  });
  it("creates approval and audit records in the same function", () => {
    expect(sql).toContain("create or replace function public.request_task_runtime_approval");
    expect(sql).toContain("'approval.requested'");
  });
});
