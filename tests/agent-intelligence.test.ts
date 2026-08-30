import { describe, expect, it } from "vitest";
import { governAgentProposal, type AgentIntelligenceContext, type AgentProposal } from "../lib/domain/agent-intelligence";
import { governModelProposal } from "../lib/domain/lead-agent-policy";

const context: AgentIntelligenceContext = {
  agent: { id: "agent-1", name: "Research Specialist", department: "Marketing", role: "Evidence research", purpose: "Evaluate claims and evidence.", skills: [{ id: "skill-1", name: "Competitor Research" }], tools: [{ toolKey: "research", canRead: true, canWrite: true, requiresApproval: false }] },
  currentTask: { id: "task-1", title: "Campaign Research", status: "running", safeInputSummary: "Compare public positioning." },
  organization: { agents: [{ id: "agent-1", name: "Research Specialist", status: "active" }, { id: "agent-2", name: "Review Specialist", status: "active" }], tasks: [{ id: "task-1", title: "Campaign Research", status: "running", agentName: "Research Specialist" }], approvals: [], events: [] },
  governance: { previewMode: false, directMutationAllowed: false, externalActionsRequireApproval: true },
};
const proposal = (values: Partial<AgentProposal> = {}): AgentProposal => ({ interpretedIntent: "specialist_work", responseMode: "RECOMMEND", proposedAction: "Compare claims against evidence", actionKey: null, targetTask: "Campaign Research", targetAgent: null, result: "Evidence review recommended", confidence: "high", blocker: null, clarificationRequest: null, approvalRequired: false, explanation: "The request fits the assigned role.", ...values });

describe("shared Agent Intelligence policy", () => {
  it("preserves Lead Agent deterministic behavior", () => expect(governModelProposal("What is waiting for approval?", null, { agentNames: [], taskTitles: [], previewMode: false }).intent.kind).toBe("read_approvals"));
  it("accepts specialist reasoning through the shared contract", () => expect(governAgentProposal(proposal(), context)).toMatchObject({ responseMode: "RECOMMEND", accepted: true }));
  it("includes registry role and assigned skills in context", () => expect(context.agent).toMatchObject({ role: "Evidence research", skills: [{ name: "Competitor Research" }] }));
  it("allows a specialist to challenge weak work", () => expect(governAgentProposal(proposal({ responseMode: "CHALLENGE", explanation: "The claim lacks evidence." }), context)).toMatchObject({ responseMode: "CHALLENGE", accepted: true }));
  it("allows a specialist to request clarification", () => expect(governAgentProposal(proposal({ responseMode: "CLARIFY", clarificationRequest: "Which market?" }), context).responseMode).toBe("CLARIFY"));
  it("allows a governed handoff proposal to a registered agent", () => expect(governAgentProposal(proposal({ interpretedIntent: "handoff", responseMode: "DELEGATE", targetAgent: "Review Specialist" }), context)).toMatchObject({ responseMode: "DELEGATE", accepted: true }));
  it("blocks an unauthorized action", () => expect(governAgentProposal(proposal({ responseMode: "EXECUTE", actionKey: "publish" }), context)).toMatchObject({ responseMode: "REFUSE", accepted: false }));
  it("fails safely without a provider proposal", () => expect(governAgentProposal(null, context)).toMatchObject({ responseMode: "CLARIFY", accepted: false }));
});
