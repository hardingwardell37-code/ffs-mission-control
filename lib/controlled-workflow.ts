"use server";

import { writeAudit } from "@/lib/audit";
import { requireContext } from "@/lib/auth";
import { advanceWorkflow, resumeWorkflow, startWorkflow, workflowAuditEvent, type WorkflowState } from "@/lib/domain/controlled-workflow";
import { executeSpecialistStep } from "@/lib/specialist-execution";
import { completeTask, handoffTask, startTask } from "@/lib/task-runtime";

type AgentRecord = { id: string; name: string; purpose: string; department: string | null };
export type ControlledWorkflowResult = { status: string; steps: number; currentAgentId: string; reason: string | null; output: string | null };
const reviewerRole = (agent: AgentRecord) => /review|quality|governance|approv/i.test(`${agent.purpose} ${agent.department ?? ""}`);
const isState = (value: unknown): value is WorkflowState => Boolean(value && typeof value === "object" && "taskId" in value && "status" in value && "steps" in value);

export async function runControlledWorkflow(taskId: string, objective: string, reviewRequired = true): Promise<ControlledWorkflowResult> {
  const ctx = await requireContext();
  if (ctx.previewMode) return { status: "stopped", steps: 0, currentAgentId: "", reason: "Deploy Preview is read-only.", output: null };
  const [taskResult, agentsResult, priorResult] = await Promise.all([
    ctx.supabase.from("tasks").select("id, title, status, agent_id").eq("id", taskId).eq("organization_id", ctx.organizationId).single(),
    ctx.supabase.from("agents").select("id, name, purpose, department").eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null),
    ctx.supabase.from("audit_events").select("metadata").eq("organization_id", ctx.organizationId).eq("entity_id", taskId).like("event_type", "workflow.%").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (taskResult.error || agentsResult.error || priorResult.error || !taskResult.data.agent_id) throw new Error("Workflow task or registered agents are unavailable");
  const agents = agentsResult.data as AgentRecord[];
  let state = isState(priorResult.data?.metadata?.workflowState) ? priorResult.data.metadata.workflowState : startWorkflow(taskId, taskResult.data.agent_id, reviewRequired);
  const auditState = async (eventType: string, extra: Record<string, unknown> = {}) => { const event = workflowAuditEvent(eventType, state, extra); await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: event.eventType, entityType: "task", entityId: taskId, metadata: event.metadata }); };
  if (!priorResult.data) await auditState("workflow.started", { objectiveRecorded: true });

  if (state.status === "paused") {
    const { data: approval, error } = await ctx.supabase.from("approvals").select("status").eq("organization_id", ctx.organizationId).eq("task_id", taskId).order("requested_at", { ascending: false }).limit(1).maybeSingle();
    if (error || !approval) { state = { ...state, status: "stopped", stopReason: "Approval state is unavailable." }; await auditState("workflow.stopped"); return { status: state.status, steps: state.steps.length, currentAgentId: state.currentAgentId, reason: state.stopReason, output: null }; }
    const resumed = resumeWorkflow(state, approval.status);
    state = resumed.state;
    if (resumed.decision === "pause") return { status: state.status, steps: state.steps.length, currentAgentId: state.currentAgentId, reason: resumed.reason, output: null };
    if (resumed.decision === "stop") { await auditState("workflow.stopped", { approvalStatus: approval.status }); return { status: state.status, steps: state.steps.length, currentAgentId: state.currentAgentId, reason: resumed.reason, output: null }; }
    await startTask(taskId);
    await auditState("workflow.resumed", { approvalStatus: approval.status });
    if (state.reviewRequired && !state.reviewed) {
      const reviewer = agents.find((item) => !state.visitedAgentIds.includes(item.id) && reviewerRole(item));
      if (!reviewer) { state = { ...state, status: "stopped", stopReason: "A distinct registered reviewer is required after approval." }; await auditState("workflow.stopped"); return { status: state.status, steps: state.steps.length, currentAgentId: state.currentAgentId, reason: state.stopReason, output: null }; }
      await handoffTask(taskId, reviewer.id, "Controlled workflow resumed and routed task to registered reviewer.");
      state = { ...state, currentAgentId: reviewer.id };
      await auditState("workflow.handoff", { destinationAgentId: reviewer.id });
    } else {
      await completeTask(taskId, "report", "Controlled workflow result", "Controlled multi-agent workflow completed after governed approval.");
      state = { ...state, status: "completed", stopReason: null };
      await auditState("workflow.completed", { outputStored: true, approvalStatus: approval.status });
      return { status: state.status, steps: state.steps.length, currentAgentId: state.currentAgentId, reason: null, output: "Controlled multi-agent workflow completed after governed approval." };
    }
  }
  if (state.status !== "active") return { status: state.status, steps: state.steps.length, currentAgentId: state.currentAgentId, reason: state.stopReason, output: null };
  if (taskResult.data.status === "queued") await startTask(taskId);

  let output: string | null = null;
  while (state.status === "active" && state.steps.length < 4) {
    const agent = agents.find((item) => item.id === state.currentAgentId);
    if (!agent) { state = { ...state, status: "stopped", stopReason: "Active workflow agent is unavailable." }; await auditState("workflow.stopped"); break; }
    await auditState("workflow.step_started", { agentId: agent.id });
    const allowedNames = agents.filter((item) => item.id !== agent.id && !state.visitedAgentIds.includes(item.id)).map((item) => item.name);
    const result = await executeSpecialistStep(agent.id, taskId, objective, { deferCompletion: true, allowedHandoffAgentNames: allowedNames });
    output = result.result ?? output;
    const handoffAgent = result.handoffDestination ? agents.find((item) => item.name.toLowerCase() === result.handoffDestination!.toLowerCase()) : null;
    const reviewer = agents.find((item) => item.id !== agent.id && !state.visitedAgentIds.includes(item.id) && reviewerRole(item));
    const approvalBlocked = result.approvalRequired && result.action !== "Approval requested" ? "Approval request is not authorized." : result.blocker;
    const advanced = advanceWorkflow(state, { agentId: agent.id, responseMode: result.responseMode, reviewer: reviewerRole(agent), blocker: approvalBlocked, clarification: result.clarification, approvalRequired: result.approvalRequired, handoffAgentId: handoffAgent?.id ?? null, reviewerAgentId: reviewer?.id ?? null });
    state = advanced.state;
    await auditState(reviewerRole(agent) ? "workflow.review_result" : "workflow.specialist_result", { agentId: agent.id, responseMode: result.responseMode, action: result.action });
    if (advanced.decision === "pause") { await auditState("workflow.approval_paused"); break; }
    if (advanced.decision === "stop") { await auditState("workflow.stopped", { reason: advanced.reason }); break; }
    if (advanced.decision === "route_reviewer") { await handoffTask(taskId, state.currentAgentId, "Controlled workflow routed task to registered reviewer."); await auditState("workflow.handoff", { destinationAgentId: state.currentAgentId }); continue; }
    if (advanced.decision === "continue") { await auditState("workflow.handoff", { destinationAgentId: state.currentAgentId }); continue; }
    if (advanced.decision === "complete") {
      await completeTask(taskId, "report", "Controlled workflow result", output ?? "Controlled multi-agent workflow completed successfully.");
      await auditState("workflow.completed", { outputStored: true });
      break;
    }
  }
  if (state.status === "active" && state.steps.length >= 4) { state = { ...state, status: "stopped", stopReason: "Maximum workflow step limit reached." }; await auditState("workflow.stopped"); }
  return { status: state.status, steps: state.steps.length, currentAgentId: state.currentAgentId, reason: state.stopReason, output };
}
