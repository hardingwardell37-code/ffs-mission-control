import { modeForIntent, parseLeadCommand, previewAllowsIntent, type LeadIntent, type LeadMode } from "./lead-agent";

export type ModelProposal = {
  intent: "read_approvals" | "read_agent_work" | "read_completed" | "read_failed" | "create_task" | "handoff" | "external_action" | "destructive_action" | "clarify";
  responseMode: LeadMode;
  targetAgent: string | null;
  targetTask: string | null;
  proposedAction: string;
  confidence: "low" | "medium" | "high";
  explanation: string;
};

export type LeadPolicyContext = { agentNames: string[]; taskTitles: string[]; previewMode: boolean };
export type GovernedProposal = { intent: LeadIntent; modelAccepted: boolean; explanation?: string };
const same = (left: string, right: string) => left.trim().toLowerCase() === right.trim().toLowerCase();

export function governModelProposal(command: string, proposal: ModelProposal | null, context: LeadPolicyContext): GovernedProposal {
  const deterministic = parseLeadCommand(command);
  if (!proposal) return { intent: deterministic, modelAccepted: false };

  if (["refuse", "approval_required", "challenge"].includes(deterministic.kind)) return { intent: deterministic, modelAccepted: false };
  if (proposal.intent === "destructive_action") return { intent: { kind: "refuse", reason: "Destructive actions are outside the Lead Agent execution authority." }, modelAccepted: false };
  if (proposal.intent === "external_action") return { intent: { kind: "approval_required", action: proposal.proposedAction }, modelAccepted: false };
  if (proposal.confidence === "low" || proposal.intent === "clarify") return { intent: { kind: "clarify", question: proposal.explanation || "More operational context is required." }, modelAccepted: false };

  let intent: LeadIntent;
  if (proposal.intent === "read_approvals" || proposal.intent === "read_completed" || proposal.intent === "read_failed") intent = { kind: proposal.intent };
  else if (proposal.intent === "read_agent_work") {
    if (!proposal.targetAgent || !context.agentNames.some((name) => same(name, proposal.targetAgent!))) return { intent: { kind: "clarify", question: "Identify one existing agent for this request." }, modelAccepted: false };
    intent = { kind: "read_agent_work", agentQuery: proposal.targetAgent };
  } else if (proposal.intent === "create_task") {
    if (!proposal.targetAgent || !context.agentNames.some((name) => same(name, proposal.targetAgent!))) return { intent: { kind: "clarify", question: "Identify one existing active agent for this task." }, modelAccepted: false };
    const title = proposal.proposedAction.trim().slice(0, 180);
    if (!title) return { intent: { kind: "clarify", question: "Provide a bounded task outcome." }, modelAccepted: false };
    intent = { kind: "create_task", agentQuery: proposal.targetAgent, title, prompt: title };
  } else {
    if (!proposal.targetAgent || !context.agentNames.some((name) => same(name, proposal.targetAgent!)) || !proposal.targetTask || !context.taskTitles.some((title) => same(title, proposal.targetTask!))) return { intent: { kind: "clarify", question: "Identify one existing running task and destination agent." }, modelAccepted: false };
    intent = { kind: "handoff", taskQuery: proposal.targetTask, agentQuery: proposal.targetAgent };
  }

  if (context.previewMode && !previewAllowsIntent(intent)) return { intent: { kind: "refuse", reason: "Deploy Preview is read-only. This command would change operational state." }, modelAccepted: false };
  return { intent, modelAccepted: true, explanation: proposal.explanation };
}

export const governedMode = (value: GovernedProposal) => modeForIntent(value.intent);
