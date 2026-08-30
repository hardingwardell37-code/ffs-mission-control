import type { AgentIntelligenceContext, GovernedAgentProposal } from "./agent-intelligence";

type AgentRow = { id: string; name: string; department: string | null; purpose: string; agent_skills?: Array<{ skills: { id: string; name: string } | Array<{ id: string; name: string }> | null }>; agent_tool_permissions?: Array<{ tool_key: string; can_read: boolean; can_write: boolean; requires_approval: boolean }> };
type TaskRow = { id: string; title: string; status: string };
export type SpecialistContextInput = { agent: AgentRow; task: TaskRow; agents: AgentIntelligenceContext["organization"]["agents"]; tasks: AgentIntelligenceContext["organization"]["tasks"]; approvals: AgentIntelligenceContext["organization"]["approvals"]; events: AgentIntelligenceContext["organization"]["events"]; previewMode: boolean };

const first = <T,>(value: T | T[] | null) => Array.isArray(value) ? value[0] ?? null : value;
export function assembleSpecialistContext(input: SpecialistContextInput): AgentIntelligenceContext {
  return {
    agent: { id: input.agent.id, name: input.agent.name, department: input.agent.department, role: input.agent.purpose, purpose: input.agent.purpose, skills: (input.agent.agent_skills ?? []).map((item) => first(item.skills)).filter((skill): skill is { id: string; name: string } => Boolean(skill)), tools: (input.agent.agent_tool_permissions ?? []).map((tool) => ({ toolKey: tool.tool_key, canRead: tool.can_read, canWrite: tool.can_write, requiresApproval: tool.requires_approval })) },
    currentTask: { id: input.task.id, title: input.task.title, status: input.task.status, safeInputSummary: input.task.title },
    organization: { agents: input.agents, tasks: input.tasks, approvals: input.approvals, events: input.events },
    governance: { previewMode: input.previewMode, directMutationAllowed: false, externalActionsRequireApproval: true },
  };
}

export type RuntimeDirective = { kind: "none" | "start" | "complete" | "block" | "handoff" | "approval"; destination?: string; summary?: string; actionKey?: string };
export function planSpecialistRuntime(proposal: GovernedAgentProposal, context: AgentIntelligenceContext): RuntimeDirective {
  if (proposal.responseMode === "DELEGATE" && proposal.accepted && proposal.targetAgent) return { kind: "handoff", destination: proposal.targetAgent, summary: proposal.explanation };
  if (proposal.responseMode === "REQUIRE_APPROVAL" && proposal.actionKey) {
    const permission = context.agent.tools.find((tool) => tool.toolKey === proposal.actionKey);
    return permission?.canWrite && permission.requiresApproval ? { kind: "approval", actionKey: proposal.actionKey, summary: proposal.explanation } : { kind: "none" };
  }
  if (proposal.responseMode !== "EXECUTE" || !proposal.accepted) return { kind: "none" };
  if (proposal.actionKey === "task.start" && context.currentTask?.status === "queued") return { kind: "start" };
  if (proposal.actionKey === "task.complete" && context.currentTask?.status === "running" && proposal.result) return { kind: "complete", summary: proposal.result };
  if (proposal.actionKey === "task.block" && context.currentTask?.status === "running") return { kind: "block", summary: proposal.blocker ?? proposal.explanation };
  return { kind: "none" };
}

export function specialistAuditEvents(agentId: string, taskId: string, proposal: GovernedAgentProposal, directive: RuntimeDirective) {
  const metadata = { invokingAgentId: agentId, taskId, interpretedIntent: proposal.interpretedIntent, governedResponseMode: proposal.responseMode, action: directive.kind, handoffDestination: proposal.targetAgent, approvalRequired: proposal.approvalRequired };
  return [{ eventType: "specialist.invoked", metadata }, { eventType: "specialist.proposal_evaluated", metadata }, { eventType: `specialist.${proposal.responseMode.toLowerCase()}`, metadata }];
}
