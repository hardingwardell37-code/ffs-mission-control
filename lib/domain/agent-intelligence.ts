import { evaluateToolPermission } from "./permissions";

export type AgentResponseMode = "EXECUTE" | "DELEGATE" | "RECOMMEND" | "CHALLENGE" | "CLARIFY" | "REQUIRE_APPROVAL" | "REFUSE";
export type AgentIntelligenceContext = {
  agent: { id: string; name: string; department: string | null; role: string; purpose: string; skills: Array<{ id: string; name: string }>; tools: Array<{ toolKey: string; canRead: boolean; canWrite: boolean; requiresApproval: boolean }> };
  currentTask: { id: string; title: string; status: string; safeInputSummary: string | null } | null;
  organization: { agents: Array<{ id?: string; name: string; status: string; department?: string | null; role?: string; skills?: string[] }>; tasks: Array<{ id?: string; title: string; status: string; agentName: string | null }>; approvals: Array<{ title: string; action: string; status: string }>; events: Array<{ type: string; entity: string; timestamp: string }> };
  governance: { previewMode: boolean; directMutationAllowed: false; externalActionsRequireApproval: true };
};
export type AgentProposal = {
  interpretedIntent: "read_approvals" | "read_agent_work" | "read_completed" | "read_failed" | "create_task" | "handoff" | "external_action" | "destructive_action" | "clarify" | "specialist_work";
  responseMode: AgentResponseMode; proposedAction: string; actionKey: string | null; targetTask: string | null; targetAgent: string | null; result: string | null; confidence: "low" | "medium" | "high"; blocker: string | null; clarificationRequest: string | null; approvalRequired: boolean; explanation: string;
};
export type GovernedAgentProposal = AgentProposal & { accepted: boolean };
const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

export function governAgentProposal(proposal: AgentProposal | null, context: AgentIntelligenceContext): GovernedAgentProposal {
  if (!proposal) return { interpretedIntent: "clarify", responseMode: "CLARIFY", proposedAction: "", actionKey: null, targetTask: null, targetAgent: null, result: null, confidence: "low", blocker: "No model provider is configured.", clarificationRequest: "A configured model provider is required for specialist reasoning.", approvalRequired: false, explanation: "Specialist intelligence is unavailable; no action was fabricated.", accepted: false };
  if (proposal.interpretedIntent === "destructive_action") return { ...proposal, responseMode: "REFUSE", blocker: "Destructive action is outside agent authority.", approvalRequired: false, accepted: false };
  if (proposal.interpretedIntent === "external_action" || proposal.approvalRequired) return { ...proposal, responseMode: "REQUIRE_APPROVAL", approvalRequired: true, accepted: false };
  if (proposal.confidence === "low" || proposal.clarificationRequest) return { ...proposal, responseMode: "CLARIFY", accepted: false };
  if (proposal.responseMode === "DELEGATE") {
    if (!proposal.targetAgent || !context.organization.agents.some((agent) => same(agent.name, proposal.targetAgent!))) return { ...proposal, responseMode: "CLARIFY", clarificationRequest: "Identify one registered handoff destination.", accepted: false };
    return { ...proposal, accepted: true };
  }
  if (["CHALLENGE", "CLARIFY", "RECOMMEND"].includes(proposal.responseMode)) return { ...proposal, accepted: true };
  if (proposal.actionKey) {
    const permission = evaluateToolPermission(context.agent.tools.find((tool) => tool.toolKey === proposal.actionKey), "write");
    if (!permission.allowed) return { ...proposal, responseMode: proposal.targetAgent ? "DELEGATE" : "REFUSE", blocker: permission.reason, accepted: false };
    if (permission.requiresApproval) return { ...proposal, responseMode: "REQUIRE_APPROVAL", approvalRequired: true, accepted: false };
  }
  if (context.governance.previewMode && proposal.responseMode === "EXECUTE") return { ...proposal, responseMode: "REFUSE", blocker: "Deploy Preview is read-only.", accepted: false };
  return { ...proposal, accepted: true };
}
