"use server";

import { writeAudit } from "@/lib/audit";
import { requireContext } from "@/lib/auth";
import { applyOrchestratorApproval, completionReady, initializeOrchestratorState, orchestratorAuditEvent, recordStageResult, resolveStageAgent, selectWorkflowDefinition, workflowDefinitions, type OrchestratorState, type WorkflowAgentCandidate } from "@/lib/domain/workflow-orchestrator";
import { executeSpecialistStep } from "@/lib/specialist-execution";
import { completeTask, handoffTask, requestTaskApproval, startTask } from "@/lib/task-runtime";

export type WorkflowOrchestratorResult = { workflow: string | null; stage: string | null; status: string; responseMode: string | null; reason: string | null; completed: boolean };
const isState = (value: unknown): value is OrchestratorState => Boolean(value && typeof value === "object" && "workflowKey" in value && "currentStageIndex" in value && "completedStageKeys" in value);
const inputTaskType = (input: unknown) => input && typeof input === "object" && "taskType" in input && typeof input.taskType === "string" ? input.taskType : null;
const skillNames = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []).flatMap((assignment) => { const skills = (assignment as { skills?: unknown }).skills; return (Array.isArray(skills) ? skills : skills ? [skills] : []).map((skill) => (skill as { name?: unknown }).name).filter((name): name is string => typeof name === "string"); });

export async function advanceTaskWorkflow(taskId: string): Promise<WorkflowOrchestratorResult> {
  const ctx = await requireContext();
  if (ctx.previewMode) return { workflow: null, stage: null, status: "stopped", responseMode: "REFUSE", reason: "Deploy Preview is read-only.", completed: false };
  const [taskResult, agentsResult, priorResult] = await Promise.all([
    ctx.supabase.from("tasks").select("id, title, status, agent_id, input").eq("id", taskId).eq("organization_id", ctx.organizationId).single(),
    ctx.supabase.from("agents").select("id, name, status, purpose, department, agent_skills(skills(name))").eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null),
    ctx.supabase.from("audit_events").select("metadata").eq("organization_id", ctx.organizationId).eq("entity_id", taskId).like("event_type", "orchestrator.%").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (taskResult.error || agentsResult.error || priorResult.error) throw new Error("Workflow orchestration context is unavailable");
  const workflow = selectWorkflowDefinition(inputTaskType(taskResult.data.input), taskResult.data.title);
  if (!workflow) return { workflow: null, stage: null, status: "stopped", responseMode: "CLARIFY", reason: "No workflow definition matches this task.", completed: false };
  const agents: WorkflowAgentCandidate[] = (agentsResult.data ?? []).map((agent) => ({ id: agent.id, name: agent.name, status: agent.status, role: agent.purpose, department: agent.department, skills: skillNames(agent.agent_skills) }));
  let state = isState(priorResult.data?.metadata?.orchestratorState) ? priorResult.data.metadata.orchestratorState : initializeOrchestratorState(taskId, workflow);
  const audit = async (eventType: string, extra: Record<string, unknown> = {}) => { const event = orchestratorAuditEvent(eventType, state, extra); await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: event.eventType, entityType: "task", entityId: taskId, metadata: event.metadata }); };
  if (!priorResult.data) { await audit("orchestrator.workflow_selected", { workflowName: workflow.name }); await audit("orchestrator.initialized"); }
  if (state.workflowKey !== workflow.key) return { workflow: workflow.key, stage: null, status: "stopped", responseMode: "REFUSE", reason: "Task workflow selection cannot change after initialization.", completed: false };

  if (state.status === "paused") {
    const { data: approval, error } = await ctx.supabase.from("approvals").select("status").eq("organization_id", ctx.organizationId).eq("task_id", taskId).order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !approval || approval.status === "pending") return { workflow: workflow.key, stage: workflow.stages[state.currentStageIndex]?.key ?? null, status: "paused", responseMode: "REQUIRE_APPROVAL", reason: "Approval unresolved.", completed: false };
    state = applyOrchestratorApproval(state, approval.status);
    if (state.status === "stopped") { await audit("orchestrator.stopped", { approvalStatus: approval.status }); return { workflow: workflow.key, stage: null, status: state.status, responseMode: "REFUSE", reason: state.stopReason, completed: false }; }
    await startTask(taskId);
    await audit("orchestrator.approval_resumed", { approvalStatus: approval.status });
    if (completionReady(state, workflow)) { await completeTask(taskId, "report", `${workflow.name} result`, state.outputSummary ?? `${workflow.name} completed after approval.`); state = { ...state, status: "completed" }; await audit("orchestrator.completed", { outputStored: true }); return { workflow: workflow.key, stage: null, status: "completed", responseMode: "EXECUTE", reason: null, completed: true }; }
  }
  if (state.status !== "active") return { workflow: workflow.key, stage: null, status: state.status, responseMode: null, reason: state.stopReason, completed: state.status === "completed" };
  if (state.stepCount >= Math.min(4, workflow.maxSteps)) { state = { ...state, status: "stopped", stopReason: "Workflow step limit reached." }; await audit("orchestrator.stopped"); return { workflow: workflow.key, stage: null, status: state.status, responseMode: "REFUSE", reason: state.stopReason, completed: false }; }

  const stage = workflow.stages[state.currentStageIndex];
  if (!stage) return { workflow: workflow.key, stage: null, status: "stopped", responseMode: "CLARIFY", reason: "Workflow stage is unavailable.", completed: false };
  await audit("orchestrator.stage_resolved", { stageKey: stage.key, requiredCapabilities: stage.requiredCapabilities });
  const agent = resolveStageAgent(stage, agents, state.visitedAgentIds);
  if (!agent) { state = { ...state, status: "stopped", stopReason: `No active agent provides the ${stage.name} capability.` }; await audit("orchestrator.stopped", { stageKey: stage.key }); return { workflow: workflow.key, stage: stage.key, status: state.status, responseMode: "CLARIFY", reason: state.stopReason, completed: false }; }
  await audit("orchestrator.agent_selected", { stageKey: stage.key, agentId: agent.id });
  if (taskResult.data.status === "queued") await startTask(taskId);
  if (taskResult.data.agent_id !== agent.id) await handoffTask(taskId, agent.id, `Workflow ${workflow.key} routed stage ${stage.key} to a matching registered agent.`);
  await audit("orchestrator.step_invoked", { stageKey: stage.key, agentId: agent.id });
  const specialist = await executeSpecialistStep(agent.id, taskId, `${workflow.purpose} Current stage: ${stage.name}.`, { deferCompletion: true, allowedHandoffAgentNames: [] });
  state = recordStageResult(state, workflow, stage, agent.id, { responseMode: specialist.responseMode, blocker: specialist.blocker, clarification: specialist.clarification, approvalRequired: specialist.approvalRequired, output: specialist.result });
  await audit("orchestrator.step_result", { stageKey: stage.key, agentId: agent.id, responseMode: specialist.responseMode, action: specialist.action });
  if (state.status === "stopped") { await audit("orchestrator.stopped", { reason: state.stopReason }); return { workflow: workflow.key, stage: stage.key, status: state.status, responseMode: specialist.responseMode, reason: state.stopReason, completed: false }; }
  if (state.status === "paused") { await audit("orchestrator.approval_paused", { stageKey: stage.key }); return { workflow: workflow.key, stage: stage.key, status: state.status, responseMode: "REQUIRE_APPROVAL", reason: state.stopReason, completed: false }; }
  if (workflow.stages.every((item) => state.completedStageKeys.includes(item.key)) && workflow.approvalRequired && !state.approvalSatisfied) {
    await requestTaskApproval(taskId, `workflow.${workflow.key}.completion`, `${workflow.name} requires governed completion approval.`);
    state = { ...state, status: "paused", stopReason: "Approval unresolved." };
    await audit("orchestrator.approval_paused", { workflowApproval: true });
    return { workflow: workflow.key, stage: stage.key, status: state.status, responseMode: "REQUIRE_APPROVAL", reason: state.stopReason, completed: false };
  }
  if (completionReady(state, workflow)) {
    await completeTask(taskId, "report", `${workflow.name} result`, state.outputSummary ?? `${workflow.name} completed successfully.`);
    state = { ...state, status: "completed" };
    await audit("orchestrator.completed", { outputStored: true });
    return { workflow: workflow.key, stage: stage.key, status: state.status, responseMode: specialist.responseMode, reason: null, completed: true };
  }
  return { workflow: workflow.key, stage: stage.key, status: state.status, responseMode: specialist.responseMode, reason: null, completed: false };
}
