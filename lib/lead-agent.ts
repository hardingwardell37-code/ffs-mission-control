"use server";

import { revalidatePath } from "next/cache";
import { writeAudit } from "@/lib/audit";
import { requireContext } from "@/lib/auth";
import { modeForIntent, parseLeadCommand, previewAllowsIntent, type LeadIntent, type LeadMode } from "@/lib/domain/lead-agent";
import { parseTask } from "@/lib/validation";

export type LeadAgentState = { mode: LeadMode | null; response: string; action: string; approval: string };
export const initialLeadAgentState: LeadAgentState = { mode: null, response: "Awaiting a bounded operational command.", action: "No action taken", approval: "Not required" };

type NamedRecord = { id: string; name?: string; title?: string; status?: string; agent_id?: string | null };
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const relationName = (value: unknown) => Array.isArray(value) ? (value[0] as { name?: string } | undefined)?.name : (value as { name?: string } | null)?.name;

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

export async function runLeadAgentCommand(_previous: LeadAgentState, formData: FormData): Promise<LeadAgentState> {
  const command = String(formData.get("command") ?? "").trim().slice(0, 500);
  const intent = parseLeadCommand(command);
  const immediate = staticResponse(intent);
  if (immediate) return immediate;

  try {
    const ctx = await requireContext();
    if (ctx.previewMode && !previewAllowsIntent(intent)) return { mode: "REFUSE", response: "Deploy Preview is read-only. This command would change operational state.", action: "Preview write rejected before Supabase", approval: "Not applicable" };

    if (intent.kind === "read_approvals") {
      const { data, error } = await ctx.supabase.from("approvals").select("id, action_key, reason, requested_at, tasks(title)").eq("organization_id", ctx.organizationId).eq("status", "pending").order("requested_at", { ascending: false }).limit(5);
      if (error) throw error;
      const items = data ?? [];
      return { mode: "RECOMMEND", response: items.length ? items.map((item) => `${relationName(item.tasks) ?? "Task"}: ${item.action_key}${item.reason ? ` — ${item.reason}` : ""}`).join("\n") : "No approvals are waiting.", action: "Read pending approvals", approval: "Not required" };
    }
    if (intent.kind === "read_completed" || intent.kind === "read_failed") {
      const status = intent.kind === "read_completed" ? "completed" : "failed";
      const { data, error } = await ctx.supabase.from("tasks").select("id, title, status, finished_at, agents(name)").eq("organization_id", ctx.organizationId).eq("status", status).order("finished_at", { ascending: false }).limit(5);
      if (error) throw error;
      const items = data ?? [];
      return { mode: "RECOMMEND", response: items.length ? items.map((item) => `${item.title} · ${relationName(item.agents) ?? "Unassigned"}`).join("\n") : `No ${status} work found.`, action: `Read ${status} work`, approval: "Not required" };
    }
    if (intent.kind === "read_agent_work") {
      const { data: agents, error: agentError } = await ctx.supabase.from("agents").select("id, name, status").eq("organization_id", ctx.organizationId).is("archived_at", null);
      if (agentError) throw agentError;
      const agent = uniqueMatch((agents ?? []) as NamedRecord[], intent.agentQuery, "name");
      if (!agent) return { mode: "CLARIFY", response: `I could not identify one agent matching “${intent.agentQuery}”.`, action: "No action taken", approval: "Not required" };
      const { data, error } = await ctx.supabase.from("tasks").select("id, title, status").eq("organization_id", ctx.organizationId).eq("agent_id", agent.id).in("status", ["draft", "queued", "running", "blocked", "awaiting_approval"]).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      return { mode: "RECOMMEND", response: data?.length ? data.map((task) => `${task.title} · ${task.status}`).join("\n") : `${agent.name} has no active work.`, action: `Read ${agent.name} work`, approval: "Not required" };
    }

    if (intent.kind !== "create_task" && intent.kind !== "handoff") return initialLeadAgentState;

    const { data: agents, error: agentError } = await ctx.supabase.from("agents").select("id, name, status").eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null);
    if (agentError) throw agentError;
    const agent = uniqueMatch((agents ?? []) as NamedRecord[], intent.agentQuery, "name");
    if (!agent) return { mode: "CLARIFY", response: `Identify one active agent matching “${intent.agentQuery}”.`, action: "No action taken", approval: "Not required" };

    if (intent.kind === "create_task") {
      await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_received", entityType: "command", metadata: { interpretedAs: intent.kind, result: "accepted", approvalRequirement: "none" } });
      const taskForm = new FormData(); taskForm.set("agentId", agent.id); taskForm.set("title", intent.title); taskForm.set("prompt", intent.prompt);
      const values = parseTask(taskForm);
      const { data, error } = await ctx.supabase.from("tasks").insert({ ...values, organization_id: ctx.organizationId, requested_by: ctx.user.id }).select("id").single();
      if (error) throw error;
      await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "task.created", entityType: "task", entityId: data.id, metadata: { status: "queued", source: "lead_command" } });
      await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_executed", entityType: "task", entityId: data.id, metadata: { interpretedAs: intent.kind, result: "task_created", approvalRequirement: "none" } });
      revalidatePath("/"); revalidatePath("/tasks"); revalidatePath("/activity");
      return { mode: "EXECUTE", response: `Queued “${intent.title}” for ${agent.name}.`, action: "Internal task created", approval: "Not required" };
    }

    const { data: tasks, error: taskError } = await ctx.supabase.from("tasks").select("id, title, status, agent_id").eq("organization_id", ctx.organizationId).eq("status", "running");
    if (taskError) throw taskError;
    const task = uniqueMatch((tasks ?? []) as NamedRecord[], intent.taskQuery, "title");
    if (!task) return { mode: "CLARIFY", response: `Identify one running task matching “${intent.taskQuery}”.`, action: "No action taken", approval: "Not required" };
    await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_received", entityType: "command", metadata: { interpretedAs: intent.kind, result: "accepted", approvalRequirement: "none" } });
    const { error } = await ctx.supabase.rpc("record_task_runtime_handoff", { p_task_id: task.id, p_destination_agent_id: agent.id, p_summary: `Lead Agent delegated ${task.title} to ${agent.name}.` });
    if (error) throw error;
    await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "lead.command_executed", entityType: "task", entityId: task.id, metadata: { interpretedAs: intent.kind, result: "handoff_recorded", approvalRequirement: "none", destinationAgentId: agent.id } });
    revalidatePath("/"); revalidatePath("/tasks"); revalidatePath("/activity");
    return { mode: "DELEGATE", response: `Handed off “${task.title}” to ${agent.name}.`, action: "Governed runtime handoff recorded", approval: "Not required" };
  } catch {
    return { mode: "CLARIFY", response: "Mission Control could not complete that bounded command. Verify the referenced operational records and try again.", action: "No confirmed state change", approval: "Not assessed" };
  }
}
