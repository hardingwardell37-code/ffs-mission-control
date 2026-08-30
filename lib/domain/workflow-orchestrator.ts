export type WorkflowStageDefinition = { key: string; name: string; requiredCapabilities: string[]; reviewer: boolean; stopModes: string[] };
export type WorkflowDefinition = { key: string; name: string; purpose: string; allowedTaskTypes: string[]; stages: WorkflowStageDefinition[]; reviewerRequired: boolean; approvalRequired: boolean; completionCondition: "all_stages"; stopConditions: string[]; maxSteps: number };
export type WorkflowAgentCandidate = { id: string; name: string; status: string; role: string; department: string | null; skills: string[] };
export type OrchestratorState = { taskId: string; workflowKey: string; status: "active" | "paused" | "stopped" | "completed"; currentStageIndex: number; completedStageKeys: string[]; visitedAgentIds: string[]; stepCount: number; approvalSatisfied: boolean; outputSummary: string | null; stopReason: string | null };

export const workflowDefinitions: WorkflowDefinition[] = [
  { key: "marketing_content", name: "Marketing Content Workflow", purpose: "Produce evidence-based reviewed marketing content.", allowedTaskTypes: ["marketing_content", "campaign", "content"], stages: [
    { key: "research", name: "Research", requiredCapabilities: ["research", "intelligence", "evidence"], reviewer: false, stopModes: ["CHALLENGE", "CLARIFY", "REFUSE"] },
    { key: "content", name: "Strategy / Content", requiredCapabilities: ["strategy", "content", "copy"], reviewer: false, stopModes: ["CHALLENGE", "CLARIFY", "REFUSE"] },
    { key: "review", name: "Review", requiredCapabilities: ["review", "quality", "governance"], reviewer: true, stopModes: ["CHALLENGE", "CLARIFY", "REFUSE"] },
  ], reviewerRequired: true, approvalRequired: true, completionCondition: "all_stages", stopConditions: ["blocked", "failed", "clarification", "refusal", "approval_rejected"], maxSteps: 3 },
  { key: "internal_research", name: "Internal Research Workflow", purpose: "Produce and review bounded internal research.", allowedTaskTypes: ["internal_research", "research"], stages: [
    { key: "research", name: "Research", requiredCapabilities: ["research", "intelligence", "evidence"], reviewer: false, stopModes: ["CHALLENGE", "CLARIFY", "REFUSE"] },
    { key: "review", name: "Review", requiredCapabilities: ["review", "quality", "governance"], reviewer: true, stopModes: ["CHALLENGE", "CLARIFY", "REFUSE"] },
  ], reviewerRequired: true, approvalRequired: false, completionCondition: "all_stages", stopConditions: ["blocked", "failed", "clarification", "refusal"], maxSteps: 2 },
];

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function selectWorkflowDefinition(taskType: string | null, title: string) {
  const exact = taskType ? workflowDefinitions.find((workflow) => workflow.allowedTaskTypes.includes(normalize(taskType).replaceAll(" ", "_"))) : null;
  if (exact) return exact;
  const text = normalize(title);
  if (/marketing|campaign|content|copy/.test(text)) return workflowDefinitions[0];
  if (/research|analysis|investigation/.test(text)) return workflowDefinitions[1];
  return null;
}

export function resolveStageAgent(stage: WorkflowStageDefinition, agents: WorkflowAgentCandidate[], excludedAgentIds: string[]) {
  return agents.filter((agent) => agent.status === "active" && !excludedAgentIds.includes(agent.id)).filter((agent) => { const context = normalize([agent.role, agent.department ?? "", ...agent.skills].join(" ")); return stage.requiredCapabilities.some((capability) => context.includes(normalize(capability))); }).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))[0] ?? null;
}

export function initializeOrchestratorState(taskId: string, workflow: WorkflowDefinition): OrchestratorState { return { taskId, workflowKey: workflow.key, status: "active", currentStageIndex: 0, completedStageKeys: [], visitedAgentIds: [], stepCount: 0, approvalSatisfied: false, outputSummary: null, stopReason: null }; }
export function recordStageResult(state: OrchestratorState, workflow: WorkflowDefinition, stage: WorkflowStageDefinition, agentId: string, result: { responseMode: string; blocker: string | null; clarification: string | null; approvalRequired: boolean; output: string | null }) {
  if (state.status !== "active") return { ...state, status: "stopped" as const, stopReason: "Workflow is not active." };
  if (state.stepCount >= Math.min(4, workflow.maxSteps)) return { ...state, status: "stopped" as const, stopReason: "Workflow step limit reached." };
  if (state.completedStageKeys.includes(stage.key) || state.visitedAgentIds.includes(agentId)) return { ...state, status: "stopped" as const, stopReason: "Duplicate stage or repeated agent blocked." };
  const next = { ...state, stepCount: state.stepCount + 1, visitedAgentIds: [...state.visitedAgentIds, agentId], outputSummary: result.output ?? state.outputSummary };
  if (result.blocker || result.clarification || stage.stopModes.includes(result.responseMode)) return { ...next, status: "stopped" as const, stopReason: result.blocker ?? result.clarification ?? `Stage stopped on ${result.responseMode}.` };
  if (result.approvalRequired || result.responseMode === "REQUIRE_APPROVAL") return { ...next, status: "paused" as const, stopReason: "Approval unresolved." };
  if (!["EXECUTE", "RECOMMEND"].includes(result.responseMode)) return { ...next, status: "stopped" as const, stopReason: `Stage result ${result.responseMode} cannot advance this workflow.` };
  return { ...next, completedStageKeys: [...state.completedStageKeys, stage.key], currentStageIndex: state.currentStageIndex + 1, stopReason: null };
}

export function completionReady(state: OrchestratorState, workflow: WorkflowDefinition) { const allStages = workflow.stages.every((stage) => state.completedStageKeys.includes(stage.key)); const reviewerComplete = !workflow.reviewerRequired || workflow.stages.filter((stage) => stage.reviewer).every((stage) => state.completedStageKeys.includes(stage.key)); return allStages && reviewerComplete && (!workflow.approvalRequired || state.approvalSatisfied) && state.status === "active"; }
export function applyOrchestratorApproval(state: OrchestratorState, status: "pending" | "approved" | "rejected" | "cancelled" | "expired") { if (status === "pending") return state; if (status === "approved") return { ...state, status: "active" as const, approvalSatisfied: true, stopReason: null }; return { ...state, status: "stopped" as const, stopReason: `Approval ${status}.` }; }
export function orchestratorAuditEvent(eventType: string, state: OrchestratorState, extra: Record<string, unknown> = {}) { return { eventType, metadata: { orchestratorState: state, workflowKey: state.workflowKey, stageIndex: state.currentStageIndex, stepCount: state.stepCount, ...extra } }; }
