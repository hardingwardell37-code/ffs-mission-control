"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { parseAgent, parseTask } from "@/lib/validation";
import { assertApprovalResolution } from "@/lib/domain/approval";
import type { ApprovalStatus } from "@/types/domain";

export async function createAgent(form: FormData) {
  const ctx = await requireContext(); const values = parseAgent(form);
  const { data, error } = await ctx.supabase.from("agents").insert({ ...values, organization_id: ctx.organizationId, created_by: ctx.user.id }).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "agent.created", entityType: "agent", entityId: data.id });
  revalidatePath("/agents"); redirect("/agents");
}

export async function updateAgent(form: FormData) {
  const ctx = await requireContext(); const id = String(form.get("id") ?? ""); const values = parseAgent(form);
  const { error } = await ctx.supabase.from("agents").update(values).eq("id", id).eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "agent.updated", entityType: "agent", entityId: id });
  revalidatePath("/agents"); redirect("/agents");
}

export async function archiveAgent(form: FormData) {
  const ctx = await requireContext(); const id = String(form.get("id") ?? "");
  const { error } = await ctx.supabase.from("agents").update({ status: "disabled", archived_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "agent.archived", entityType: "agent", entityId: id });
  revalidatePath("/agents");
}

export async function saveToolPermission(form: FormData) {
  const ctx = await requireContext(); const agentId = String(form.get("agentId") ?? ""); const toolKey = String(form.get("toolKey") ?? "").trim().slice(0, 120);
  if (!toolKey) throw new Error("Tool key is required");
  const { data: agent } = await ctx.supabase.from("agents").select("id").eq("id", agentId).eq("organization_id", ctx.organizationId).single();
  if (!agent) throw new Error("Agent not found");
  const permission = { agent_id: agentId, tool_key: toolKey, can_read: form.get("canRead") === "on", can_write: form.get("canWrite") === "on", requires_approval: true };
  const { error } = await ctx.supabase.from("agent_tool_permissions").upsert(permission, { onConflict: "agent_id,tool_key" }); if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "agent.permission_changed", entityType: "agent", entityId: agentId, metadata: { toolKey, canRead: permission.can_read, canWrite: permission.can_write, requiresApproval: true } });
  revalidatePath(`/agents/${agentId}`);
}

export async function createTask(form: FormData) {
  const ctx = await requireContext(); const values = parseTask(form);
  const { data, error } = await ctx.supabase.from("tasks").insert({ ...values, organization_id: ctx.organizationId, requested_by: ctx.user.id }).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "task.created", entityType: "task", entityId: data.id, metadata: { status: "queued" } });
  revalidatePath("/tasks"); redirect("/tasks");
}

export async function resolveApproval(form: FormData) {
  const ctx = await requireContext(); const id = String(form.get("id") ?? ""); const next = String(form.get("status") ?? "") as ApprovalStatus;
  const { data: approval, error: readError } = await ctx.supabase.from("approvals").select("status").eq("id", id).eq("organization_id", ctx.organizationId).single();
  if (readError) throw new Error(readError.message); assertApprovalResolution(approval.status, next);
  const { error } = await ctx.supabase.from("approvals").update({ status: next, resolved_at: new Date().toISOString(), resolved_by: ctx.user.id, resolution_note: String(form.get("note") ?? "").slice(0, 1000) }).eq("id", id).eq("status", "pending");
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: `approval.${next}`, entityType: "approval", entityId: id });
  revalidatePath("/approvals");
}

export async function signOut() { const { supabase } = await requireContext(); await supabase.auth.signOut(); redirect("/login"); }
