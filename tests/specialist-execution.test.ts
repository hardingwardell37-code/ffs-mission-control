import { describe, expect, it } from "vitest";
import { governAgentProposal, type AgentProposal } from "../lib/domain/agent-intelligence";
import { assembleSpecialistContext, planSpecialistRuntime, specialistAuditEvents } from "../lib/domain/specialist-execution";

const context = assembleSpecialistContext({
  agent: { id: "agent-1", name: "Research Specialist", department: "Marketing", purpose: "Evidence research", agent_skills: [{ skills: { id: "skill-1", name: "Competitor Research" } }], agent_tool_permissions: [{ tool_key: "task.complete", can_read: true, can_write: true, requires_approval: false }, { tool_key: "campaign.publish", can_read: true, can_write: true, requires_approval: true }] },
  task: { id: "task-1", title: "Campaign Research", status: "running" },
  agents: [{ id: "agent-1", name: "Research Specialist", status: "active" }, { id: "agent-2", name: "Review Specialist", status: "active" }],
  tasks: [{ id: "task-1", title: "Campaign Research", status: "running", agentName: "Research Specialist" }], approvals: [], events: [], previewMode: false,
});
const proposal = (values: Partial<AgentProposal> = {}): AgentProposal => ({ interpretedIntent: "specialist_work", responseMode: "RECOMMEND", proposedAction: "Evaluate evidence", actionKey: null, targetTask: "Campaign Research", targetAgent: null, result: "Evidence evaluated", confidence: "high", blocker: null, clarificationRequest: null, approvalRequired: false, explanation: "Bounded specialist work.", ...values });

describe("specialist execution planning", () => {
  it("assembles real-shaped registry, task, skill, and permission context", () => { expect(context.agent).toMatchObject({ id: "agent-1", role: "Evidence research" }); expect(context.agent.skills.some((skill) => skill.name === "Competitor Research")).toBe(true); expect(context.agent.tools.some((tool) => tool.toolKey === "task.complete")).toBe(true); });
  it("plans an accepted EXECUTE result through task runtime", () => { const governed = governAgentProposal(proposal({ responseMode: "EXECUTE", actionKey: "task.complete" }), context); expect(planSpecialistRuntime(governed, context)).toMatchObject({ kind: "complete", summary: "Evidence evaluated" }); });
  it("returns a CHALLENGE without mutation", () => { const governed = governAgentProposal(proposal({ responseMode: "CHALLENGE" }), context); expect(planSpecialistRuntime(governed, context).kind).toBe("none"); });
  it("returns a CLARIFY request without mutation", () => { const governed = governAgentProposal(proposal({ responseMode: "CLARIFY", clarificationRequest: "Which market?" }), context); expect(planSpecialistRuntime(governed, context).kind).toBe("none"); });
  it("plans a governed specialist handoff", () => { const governed = governAgentProposal(proposal({ interpretedIntent: "handoff", responseMode: "DELEGATE", targetAgent: "Review Specialist" }), context); expect(planSpecialistRuntime(governed, context)).toMatchObject({ kind: "handoff", destination: "Review Specialist" }); });
  it("blocks an unauthorized proposal", () => { const governed = governAgentProposal(proposal({ responseMode: "EXECUTE", actionKey: "email.send" }), context); expect(governed).toMatchObject({ responseMode: "REFUSE", accepted: false }); expect(planSpecialistRuntime(governed, context).kind).toBe("none"); });
  it("halts an approval-required proposal at the approval runtime", () => { const governed = governAgentProposal(proposal({ responseMode: "EXECUTE", actionKey: "campaign.publish", approvalRequired: true }), context); expect(planSpecialistRuntime(governed, context)).toMatchObject({ kind: "approval", actionKey: "campaign.publish" }); });
  it("fails safely without a model proposal", () => expect(governAgentProposal(null, context)).toMatchObject({ responseMode: "CLARIFY", accepted: false }));
  it("constructs safe immutable audit events", () => { const governed = governAgentProposal(proposal({ responseMode: "CHALLENGE" }), context); const events = specialistAuditEvents("agent-1", "task-1", governed, { kind: "none" }); expect(events.map((event) => event.eventType)).toEqual(["specialist.invoked", "specialist.proposal_evaluated", "specialist.challenge"]); expect(events[0].metadata).not.toHaveProperty("prompt"); });
});
