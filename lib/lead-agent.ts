"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireContext } from "@/lib/auth";
import { modeForIntent, parseLeadCommand, previewAllowsIntent, type LeadIntent, type LeadMode } from "@/lib/domain/lead-agent";
import { governModelProposal } from "@/lib/domain/lead-agent-policy";
import type { AgentIntelligenceContext, AgentProposal } from "@/lib/domain/agent-intelligence";
import { createLeadModelProvider } from "@/lib/lead-agent-provider";
import { parseTask } from "@/lib/validation";

export type LeadAgentState = { mode: LeadMode | null; response: string; action: string; approval: string };
export const initialLeadAgentState: LeadAgentState = { mode: null, response: "Awaiting a bounded operational command.", action: "No action taken", approval: "Not required" };

type NamedRecord = { id: string; name?: string; title?: string; status?: string; agent_id?: string | null };
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const relationName = (value: unknown) => Array.isArray(value) ? (value[0] as { name?: string } | undefined)?.name : (value as { name?: string } | null)?.name;
type CommandContext = Awaited<ReturnType<typeof requireContext>>;
type ModelMeta = { provider: string; model: string } | null;

function uniqueMatch<T extends NamedRecord>(records: T[], query: string, field: "name" | "title") {
  const needle = normalize(query);
  const exact = records.filter((item) => normalize(String(item[field] ?? "")) === needle);
  if (exact.length === 1) return exact[0];
  const partial = records.filter((item) => normalize(String(item[field] ?? "")).includes(needle));
  return partial.length === 1 ? partial[0] : null;
}

function staticResponse(intent: LeadIntent): LeadAgentState | null {
  const mode = modeForIntent(intent);
  if (intent.kind === "challenge") return { mode, response: intent.reason, action: "No external action taken", approval: "Required before external execution" };
  if (intent.kind === "approval_required") return { mode, response: "This command layer will not perform the external action. Submit or resolve it through the governed approval workflow.", action: "No external action taken", approval: "Required" };
  if (intent.kind === "clarify") return { mode, response: intent.question, action: "No action taken", approval: "Not assessed" };
  if (intent.kind === "refuse") return { mode, response: intent.reason, action: "Command refused", approval: "Not applicable" };
  return null;
}

async function resolveCommand(ctx: CommandContext, command: string): Promise<{ intent: LeadIntent; model: ModelMeta }> {
  const provider = createLeadModelProvider();
  if (!provider) return { intent: parseLeadCommand(command), model: null };
  const [agentResult, taskResult, approvalResult, eventResult] = await Promise.all([
    ctx.supabase.from("agents").select("id, name, status, department, purpose, agent_skills(skills(id, name))").eq("organization_id", ctx.organizationId).is("archived_at", null).limit(30),
    ctx.supabase.from("tasks").select("title, status, agents(name)").eq("organization_id", ctx.organizationId).order("created_at", { ascending: false }).limit(30),
    ctx.supabase.from("approvals").select("action_key, status, tasks(title)").eq("organization_id", ctx.organizationId).order("requested_at", { ascending: false }).limit(20),
    ctx.supabase.from("audit_events").select("event_type, entity_type, created_at").eq("organization_id", ctx.organizationId).order("created_at", { ascending: false }).limit(15),
  ]);
  if (agentResult.error || taskResult.error || approvalResult.error || eventResult.error) return { intent: parseLeadCommand(command), model: null };
  const organizationAgents = (agentResult.data ?? []).map((agent) => ({ id: agent.id, name: agent.name, status: agent.status, department: agent.department, role: agent.purpose, skills: (agent.agent_skills ?? []).map((assignment) => relationName(assignment.skills)).filter((name): name is string => Boolean(name)) }));
  const safeContext: AgentIntelligenceContext = {
    agent: { id: "lead-agent", name: "Lead Agent", department: "Operations", role: "Mission Control orchestrator", purpose: "Interpret objectives, select specialists, coordinate governed work, and synthesize results.", skills: [], tools: [] },
    currentTask: null,
    organization: {
      agents: organizationAgents,
      tasks: (taskResult.data ?? []).map((task) => ({ title: task.title, status: task.status, agentName: relationName(task.agents) ?? null })),
      approvals: (approvalResult.data ?? []).map((approval) => ({ title: relationName(approval.tasks) ?? "Task", action: approval.action_key, status: approval.status })),
      events: (eventResult.data ?? []).map((event) => ({ type: event.event_type, entity: event.entity_type, timestamp: event.created_at })),
    },
    governance: { previewMode: ctx.previewMode, directMutationAllowed: false, externalActionsRequireApproval: true },
  };
  const result = await provider.propose(command, safeContext);
  if (!result) return { intent: parseLeadCommand(command), model: null };
  const shared = result.proposal as AgentProposal;
  const proposal = { intent: shared.interpretedIntent === "specialist_work" ? "clarify" as const : shared.interpretedIntent, responseMode: shared.responseMode, targetAgent: shared.targetAgent, targetTask: shared.targetTask, proposedAction: shared.proposedAction, confidence: shared.confidence, explanation: shared.explanation };
  const governed = governModelProposal(command, proposal, { agentNames: safeContext.organization.agents.map((agent) => agent.name), taskTitles: safeContext.organization.tasks.map((task) => task.title), previewMode: ctx.previewMode });
  return { intent: governed.intent, model: { provider: result.provider, model: result.model } };
}

async function auditModelResult(ctx: CommandContext, intent: LeadIntent, model: ModelMeta, result: string) {
  if (!model || ctx.previewMode) return;
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.model_interpreted", entityType: "command", metadata: { commandReceived: true, interpretedIntent: intent.kind, finalGovernedAction: result, finalResponseMode: modeForIntent(intent), provider: model.provider, model: model.model } });
}

export async function runLeadAgentCommand(_previous: LeadAgentState, formData: FormData): Promise<LeadAgentState> {
  const command = String(formData.get("command") ?? "").trim().slice(0, 500);

  try {
    const ctx = await requireContext();
    const resolved = await resolveCommand(ctx, command);
    const intent = resolved.intent;
    const immediate = staticResponse(intent);
    if (immediate) { await auditModelResult(ctx, intent, resolved.model, immediate.action); return immediate; }
    if (ctx.previewMode && !previewAllowsIntent(intent)) return { mode: "REFUSE", response: "Deploy Preview is read-only. This command would change operational state.", action: "Preview write rejected before Supabase", approval: "Not applicable" };

    if (intent.kind === "read_approvals") {
      const { data, error } = await ctx.supabase.from("approvals").select("id, action_key, reason, requested_at, tasks(title)").eq("organization_id", ctx.organizationId).eq("status", "pending").order("requested_at", { ascending: false }).limit(5);
      if (error) throw error;
      const items = data ?? [];
      await auditModelResult(ctx, intent, resolved.model, "read_pending_approvals");
      return { mode: "RECOMMEND", response: items.length ? items.map((item) => `${relationName(item.tasks) ?? "Task"}: ${item.action_key}${item.reason ? ` — ${item.reason}` : ""}`).join("\n") : "No approvals are waiting.", action: "Read pending approvals", approval: "Not required" };
    }
    if (intent.kind === "read_completed" || intent.kind === "read_failed") {
      const status = intent.kind === "read_completed" ? "completed" : "failed";
      const { data, error } = await ctx.supabase.from("tasks").select("id, title, status, finished_at, agents(name)").eq("organization_id", ctx.organizationId).eq("status", status).order("finished_at", { ascending: false }).limit(5);
      if (error) throw error;
      const items = data ?? [];
      await auditModelResult(ctx, intent, resolved.model, `read_${status}_work`);
      return { mode: "RECOMMEND", response: items.length ? items.map((item) => `${item.title} · ${relationName(item.agents) ?? "Unassigned"}`).join("\n") : `No ${status} work found.`, action: `Read ${status} work`, approval: "Not required" };
    }
    if (intent.kind === "read_agent_work") {
      const { data: agents, error: agentError } = await ctx.supabase.from("agents").select("id, name, status").eq("organization_id", ctx.organizationId).is("archived_at", null);
      if (agentError) throw agentError;
      const agent = uniqueMatch((agents ?? []) as NamedRecord[], intent.agentQuery, "name");
      if (!agent) return { mode: "CLARIFY", response: `I could not identify one agent matching “${intent.agentQuery}”.`, action: "No action taken", approval: "Not required" };
      const { data, error } = await ctx.supabase.from("tasks").select("id, title, status").eq("organization_id", ctx.organizationId).eq("agent_id", agent.id).in("status", ["draft", "queued", "running", "blocked", "awaiting_approval"]).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      await auditModelResult(ctx, intent, resolved.model, "read_agent_work");
      return { mode: "RECOMMEND", response: data?.length ? data.map((task) => `${task.title} · ${task.status}`).join("\n") : `${agent.name} has no active work.`, action: `Read ${agent.name} work`, approval: "Not required" };
    }

    if (intent.kind !== "create_task" && intent.kind !== "handoff") return initialLeadAgentState;

    const { data: agents, error: agentError } = await ctx.supabase.from("agents").select("id, name, status").eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null);
    if (agentError) throw agentError;
    const agent = uniqueMatch((agents ?? []) as NamedRecord[], intent.agentQuery, "name");
    if (!agent) return { mode: "CLARIFY", response: `Identify one active agent matching “${intent.agentQuery}”.`, action: "No action taken", approval: "Not required" };

    if (intent.kind === "create_task") {
      await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_received", entityType: "command", metadata: { interpretedAs: intent.kind, result: "accepted", approvalRequirement: "none", provider: resolved.model?.provider ?? "deterministic", model: resolved.model?.model ?? null } });
      const taskForm = new FormData(); taskForm.set("agentId", agent.id); taskForm.set("title", intent.title); taskForm.set("prompt", intent.prompt);
      const values = parseTask(taskForm);
      const { data, error } = await ctx.supabase.from("tasks").insert({ ...values, organization_id: ctx.organizationId, requested_by: ctx.user.id }).select("id").single();
      if (error) throw error;
      await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "task.created", entityType: "task", entityId: data.id, metadata: { status: "queued", source: "lead_command" } });
      await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_executed", entityType: "task", entityId: data.id, metadata: { interpretedAs: intent.kind, result: "task_created", finalResponseMode: "EXECUTE", approvalRequirement: "none", provider: resolved.model?.provider ?? "deterministic", model: resolved.model?.model ?? null } });
      revalidatePath("/"); revalidatePath("/tasks"); revalidatePath("/activity");
      return { mode: "EXECUTE", response: `Queued “${intent.title}” for ${agent.name}.`, action: "Internal task created", approval: "Not required" };
    }

    const { data: tasks, error: taskError } = await ctx.supabase.from("tasks").select("id, title, status, agent_id").eq("organization_id", ctx.organizationId).eq("status", "running");
    if (taskError) throw taskError;
    const task = uniqueMatch((tasks ?? []) as NamedRecord[], intent.taskQuery, "title");
    if (!task) return { mode: "CLARIFY", response: `Identify one running task matching “${intent.taskQuery}”.`, action: "No action taken", approval: "Not required" };
    await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_received", entityType: "command", metadata: { interpretedAs: intent.kind, result: "accepted", approvalRequirement: "none", provider: resolved.model?.provider ?? "deterministic", model: resolved.model?.model ?? null } });
    const { error } = await ctx.supabase.rpc("record_task_runtime_handoff", { p_task_id: task.id, p_destination_agent_id: agent.id, p_summary: `Lead Agent delegated ${task.title} to ${agent.name}.` });
    if (error) throw error;
    await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_executed", entityType: "task", entityId: task.id, metadata: { interpretedAs: intent.kind, result: "handoff_recorded", finalResponseMode: "DELEGATE", approvalRequirement: "none", destinationAgentId: agent.id, provider: resolved.model?.provider ?? "deterministic", model: resolved.model?.model ?? null } });
    revalidatePath("/"); revalidatePath("/tasks"); revalidatePath("/activity");
    return { mode: "DELEGATE", response: `Handed off “${task.title}” to ${agent.name}.`, action: "Governed runtime handoff recorded", approval: "Not required" };
  } catch {
    return { mode: "CLARIFY", response: "Mission Control could not complete that bounded command. Verify the referenced operational records and try again.", action: "No confirmed state change", approval: "Not assessed" };
  }
}
