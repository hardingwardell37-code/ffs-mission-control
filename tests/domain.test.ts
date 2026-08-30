import { describe, expect, it, vi } from "vitest";
import { canTransitionTask, assertTaskCompletionAllowed, assertTaskTransition } from "../lib/domain/task-state";
import { assertApprovalResolution } from "../lib/domain/approval";
import { evaluateToolPermission } from "../lib/domain/permissions";
import { parseAgent, parseTask } from "../lib/validation";
import { writeAudit } from "../lib/audit";

describe("deny-by-default permissions", () => {
  it("rejects unregistered tools", () => expect(evaluateToolPermission(undefined, "write").allowed).toBe(false));
  it("requires approval for granted writes", () => expect(evaluateToolPermission({ toolKey:"mail", canRead:false, canWrite:true, requiresApproval:true }, "write")).toMatchObject({ allowed:true, requiresApproval:true }));
});
describe("task lifecycle", () => {
  it("allows the queued execution contract", () => expect(canTransitionTask("queued", "running")).toBe(true));
  it("supports the governed runtime path", () => {
    expect(canTransitionTask("draft", "queued")).toBe(true);
    expect(canTransitionTask("running", "awaiting_approval")).toBe(true);
    expect(canTransitionTask("awaiting_approval", "completed")).toBe(true);
  });
  it("rejects terminal state mutation", () => expect(() => assertTaskTransition("completed", "running")).toThrow("Invalid task transition"));
  it("rejects an invalid shortcut", () => expect(() => assertTaskTransition("queued", "completed")).toThrow("Invalid task transition"));
  it("prevents completion while approval is pending", () => expect(() => assertTaskCompletionAllowed("awaiting_approval", ["pending"])).toThrow("unresolved"));
  it("prevents completion after a rejected approval", () => expect(() => assertTaskCompletionAllowed("running", ["rejected"])).toThrow("unresolved"));
  it("allows completion after approval", () => expect(() => assertTaskCompletionAllowed("awaiting_approval", ["approved"])).not.toThrow());
});
describe("approval invariants", () => {
  it("allows a pending decision", () => expect(() => assertApprovalResolution("pending", "approved")).not.toThrow());
  it("prevents repeated decisions", () => expect(() => assertApprovalResolution("approved", "rejected")).toThrow("Only pending"));
});
describe("server validation", () => {
  it("accepts a complete agent", () => { const f=new FormData(); Object.entries({name:"Scout",slug:"scout",purpose:"Research",instructions:"Stay bounded",provider:"openai",model:"gpt",maxRuntimeSeconds:"300",status:"draft"}).forEach(([k,v])=>f.set(k,v)); expect(parseAgent(f).slug).toBe("scout"); });
  it("creates queued tasks only", () => { const f=new FormData(); f.set("agentId","00000000-0000-0000-0000-000000000001"); f.set("title","Inspect"); f.set("prompt","Read only"); expect(parseTask(f).status).toBe("queued"); });
});
describe("audit writes", () => {
  it("inserts actor identity and organization context", async () => { const insert=vi.fn().mockReturnValue({error:null}); const client={from:vi.fn().mockReturnValue({insert})}; await writeAudit(client as never,{organizationId:"org",actorId:"user",eventType:"agent.created",entityType:"agent",entityId:"a"}); expect(insert).toHaveBeenCalledWith(expect.objectContaining({organization_id:"org",actor_id:"user",event_type:"agent.created"})); });
});
