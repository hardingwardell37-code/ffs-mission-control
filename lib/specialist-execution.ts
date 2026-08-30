"use server";

import { revalidatePath } from "next/cache";
import { invokeAgentIntelligence } from "@/lib/agent-intelligence";
import { writeAudit } from "@/lib/audit";
import { requireContext } from "@/lib/auth";
import { assembleSpecialistContext, planSpecialistRuntime, specialistAuditEvents } from "@/lib/domain/specialist-execution";
import { blockTask, completeTask, handoffTask, requestTaskApproval, startTask } from "@/lib/task-runtime";

type Relation<T> = T | T[] | null;
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;
export type SpecialistExecutionResult = { agent: string; task: string; responseMode: string; action: string; result: string | null; confidence: string; blocker: string | null; clarification: string | null; approvalRequired: boolean; handoffDestination: string | null };

export async function executeSpecialistStep(agentId: string, taskId: string, instruction: string): Promise<SpecialistExecutionResult> {
  const ctx = await requireContext();
  const [agentResult, taskResult, agentsResult, tasksResult, approvalsResult, eventsResult] = await Promise.all([
    ctx.supabase.from("agents").select("id, name, department, purpose, status, agent_skills(skills(id, name)), agent_tool_permissions(tool_key, can_read, can_write, requires_approval)").eq("id", agentId).eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null).single(),
    ctx.supabase.from("tasks").select("id, title, status, agent_id").eq("id", taskId).eq("organization_id", ctx.organizationId).single(),
    ctx.supabase.from("agents").select("id, name, status, department, purpose").eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null).limit(30),
    ctx.supabase.from("tasks").select("id, title, status, agents(name)").eq("organization_id", ctx.organizationId).order("created_at", { ascending: false }).limit(30),
    ctx.supabase.from("approvals").select("action_key, status, tasks(title)").eq("organization_id", ctx.organizationId).order("requested_at", { ascending: false }).limit(20),
    ctx.supabase.from("audit_events").select("event_type, entity_type, created_at").eq("organization_id", ctx.organizationId).order("created_at", { ascending: false }).limit(15),
  ]);
  if (agentResult.error || taskResult.error || agentsResult.error || tasksResult.error || approvalsResult.error || eventsResult.error) throw new Error("Specialist context is unavailable");
  if (taskResult.data.agent_id !== agentId) throw new Error("Task is not assigned to this specialist");
  const context = assembleSpecialistContext({ agent: agentResult.data, task: taskResult.data, agents: (agentsResult.data ?? []).map((agent) => ({ id: agent.id, name: agent.name, status: agent.status, department: agent.department, role: agent.purpose })), tasks: (tasksResult.data ?? []).map((task) => ({ id: task.id, title: task.title, status: task.status, agentName: one(task.agents)?.name ?? null })), approvals: (approvalsResult.data ?? []).map((approval) => ({ title: one(approval.tasks)?.title ?? "Task", action: approval.action_key, status: approval.status })), events: (eventsResult.data ?? []).map((event) => ({ type: event.event_type, entity: event.entity_type, timestamp: event.created_at })), previewMode: ctx.previewMode });
  const intelligence = await invokeAgentIntelligence(instruction, context);
  const directive = planSpecialistRuntime(intelligence.governed, context);
  const audit = async (eventType: string, metadata: Record<string, unknown>) => { if (!ctx.previewMode) await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType, entityType: "task", entityId: taskId, metadata: { ...metadata, provider: intelligence.provider, model: intelligence.model } }); };
  for (const event of specialistAuditEvents(agentId, taskId, intelligence.governed, directive)) await audit(event.eventType, event.metadata);

  let action = "No runtime mutation";
  if (directive.kind === "start") { await startTask(taskId); action = "Task started"; }
  if (directive.kind === "complete") { await completeTask(taskId, "report", `${agentResult.data.name} result`, directive.summary!); action = "Task completed"; }
  if (directive.kind === "block") { await blockTask(taskId, directive.summary!); action = "Task blocked"; }
  if (directive.kind === "approval") { await audit("specialist.approval_required", { agentId, actionKey: directive.actionKey }); await requestTaskApproval(taskId, directive.actionKey!, directive.summary!); action = "Approval requested"; }
  if (directive.kind === "handoff") {
    const destination = (agentsResult.data ?? []).find((agent) => agent.name.toLowerCase() === directive.destination!.toLowerCase());
    if (!destination) throw new Error("Handoff destination is unavailable");
    await audit("specialist.handoff_initiated", { agentId, destinationAgentId: destination.id });
    await handoffTask(taskId, destination.id, directive.summary!); action = `Handed off to ${destination.name}`;
    await audit("specialist.handoff_completed", { agentId, destinationAgentId: destination.id });
  }
  if (!["none", "handoff"].includes(directive.kind)) await audit("specialist.runtime_completed", { agentId, runtimeAction: directive.kind });
  revalidatePath("/"); revalidatePath("/tasks"); revalidatePath("/activity");
  return { agent: agentResult.data.name, task: taskResult.data.title, responseMode: intelligence.governed.responseMode, action, result: intelligence.governed.result, confidence: intelligence.governed.confidence, blocker: intelligence.governed.blocker, clarification: intelligence.governed.clarificationRequest, approvalRequired: intelligence.governed.approvalRequired, handoffDestination: intelligence.governed.targetAgent };
}
