import { describe, expect, it } from "vitest";
import { deriveAgentCommunications, type CommunicationEvent } from "../lib/domain/agent-communications";

const context = { agents: [{ id: "a", name: "Market Intelligence" }, { id: "b", name: "Content Strategist" }, { id: "r", name: "Marketing Reviewer" }], tasks: [{ id: "t", title: "Campaign Brief", agent_id: "r" }], approvals: [{ task_id: "t", status: "approved" }] };
const event = (event_type: string, metadata: Record<string, unknown> = {}): CommunicationEvent => ({ id: event_type, event_type, entity_id: "t", created_at: "2026-08-30T12:00:00.000Z", metadata });
const derive = (value: CommunicationEvent) => deriveAgentCommunications([value], context)[0];

describe("agent communications", () => {
  it("formats a handoff with source and destination", () => expect(derive(event("specialist.handoff_completed", { agentId: "a", destinationAgentId: "b" }))).toMatchObject({ source: "Market Intelligence", destination: "Content Strategist", summary: "Work handoff recorded." }));
  it("formats a challenge", () => expect(derive(event("specialist.challenge", { invokingAgentId: "a" }))).toMatchObject({ source: "Market Intelligence", destination: "Lead Agent", severity: "warning" }));
  it("formats a clarification request", () => expect(derive(event("specialist.clarify", { invokingAgentId: "b" })).summary).toContain("Clarification requested"));
  it("formats approval pause and resume", () => { expect(derive(event("orchestrator.approval_paused"))).toMatchObject({ severity: "approval", destination: "Approver" }); expect(derive(event("orchestrator.approval_resumed"))).toMatchObject({ severity: "success", destination: "Lead Agent" }); });
  it("formats blockers and failures distinctly", () => { expect(derive(event("task.blocked"))).toMatchObject({ severity: "warning" }); expect(derive(event("task.failed"))).toMatchObject({ severity: "failure" }); });
  it("formats completion", () => expect(derive(event("orchestrator.completed"))).toMatchObject({ severity: "success", destination: "Mission Control" }));
  it("never exposes prompts, reasoning, or raw model output", () => { const result = derive(event("specialist.challenge", { prompt: "secret prompt", reasoning: "hidden", result: "raw model output", invokingAgentId: "a" })); expect(JSON.stringify(result)).not.toMatch(/secret prompt|hidden|raw model output/); });
  it("ignores unsupported audit events safely", () => expect(deriveAgentCommunications([event("crm.contact.updated", { prompt: "private" })], context)).toEqual([]));
});
