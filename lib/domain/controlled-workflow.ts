export type WorkflowStatus = "active" | "paused" | "stopped" | "completed";
export type WorkflowState = { taskId: string; status: WorkflowStatus; currentAgentId: string; visitedAgentIds: string[]; steps: Array<{ agentId: string; responseMode: string; reviewer: boolean }>; reviewRequired: boolean; reviewed: boolean; stopReason: string | null };
export type WorkflowStep = { agentId: string; responseMode: string; reviewer: boolean; blocker: string | null; clarification: string | null; approvalRequired: boolean; handoffAgentId: string | null; reviewerAgentId: string | null };
export type WorkflowDecision = "continue" | "route_reviewer" | "pause" | "stop" | "complete";
export type WorkflowAdvance = { state: WorkflowState; decision: WorkflowDecision; reason: string | null };
const stopped = (state: WorkflowState, reason: string): WorkflowAdvance => ({ state: { ...state, status: "stopped", stopReason: reason }, decision: "stop", reason });

export function startWorkflow(taskId: string, firstAgentId: string, reviewRequired = true): WorkflowState { return { taskId, status: "active", currentAgentId: firstAgentId, visitedAgentIds: [], steps: [], reviewRequired, reviewed: false, stopReason: null }; }
export function advanceWorkflow(state: WorkflowState, step: WorkflowStep): WorkflowAdvance {
  if (state.status !== "active") return stopped(state, "Workflow is not active.");
  if (state.steps.length >= 4) return stopped(state, "Maximum workflow step limit reached.");
  if (step.agentId !== state.currentAgentId) return stopped(state, "Step agent does not match the active route.");
  if (state.visitedAgentIds.includes(step.agentId)) return stopped(state, "Repeated-agent route blocked.");
  const next = { ...state, visitedAgentIds: [...state.visitedAgentIds, step.agentId], steps: [...state.steps, { agentId: step.agentId, responseMode: step.responseMode, reviewer: step.reviewer }], reviewed: state.reviewed || step.reviewer };
  if (step.blocker || step.clarification || ["REFUSE", "CLARIFY", "CHALLENGE"].includes(step.responseMode)) return stopped(next, step.blocker ?? step.clarification ?? `Workflow stopped on ${step.responseMode}.`);
  if (step.approvalRequired || step.responseMode === "REQUIRE_APPROVAL") return { state: { ...next, status: "paused", stopReason: "Approval unresolved." }, decision: "pause", reason: "Approval unresolved." };
  if (step.responseMode === "DELEGATE") {
    if (!step.handoffAgentId) return stopped(next, "Handoff destination is missing.");
    if (step.handoffAgentId === step.agentId || next.visitedAgentIds.includes(step.handoffAgentId)) return stopped(next, "Repeated or self-directed handoff blocked.");
    if (next.steps.length >= 4) return stopped(next, "Maximum workflow step limit reached.");
    return { state: { ...next, currentAgentId: step.handoffAgentId }, decision: "continue", reason: null };
  }
  if (next.reviewRequired && !next.reviewed) {
    if (!step.reviewerAgentId || next.visitedAgentIds.includes(step.reviewerAgentId)) return stopped(next, "A distinct registered reviewer is required.");
    return { state: { ...next, currentAgentId: step.reviewerAgentId }, decision: "route_reviewer", reason: null };
  }
  return { state: { ...next, status: "completed", stopReason: null }, decision: "complete", reason: null };
}

export function resumeWorkflow(state: WorkflowState, approvalStatus: "pending" | "approved" | "rejected" | "cancelled" | "expired") {
  if (state.status !== "paused") return { state, decision: "stop" as const, reason: "Workflow is not paused." };
  if (approvalStatus === "pending") return { state, decision: "pause" as const, reason: "Approval unresolved." };
  if (approvalStatus !== "approved") return { state: { ...state, status: "stopped" as const, stopReason: `Approval ${approvalStatus}.` }, decision: "stop" as const, reason: `Approval ${approvalStatus}.` };
  return { state: { ...state, status: "active" as const, stopReason: null }, decision: "continue" as const, reason: null };
}

export function workflowAuditEvent(eventType: string, state: WorkflowState, extra: Record<string, unknown> = {}) { return { eventType, metadata: { workflowState: state, stepCount: state.steps.length, currentAgentId: state.currentAgentId, status: state.status, ...extra } }; }
