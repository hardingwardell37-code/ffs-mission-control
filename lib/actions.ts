"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { parseAgent, parseCompany, parseContact, parseCrmActivity, parseLead, parseOpportunity, parseSkill, parseTask } from "@/lib/validation";
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

export async function createSkill(form: FormData) {
  const ctx = await requireContext(); const values = parseSkill(form);
  const { data, error } = await ctx.supabase.from("skills").insert({ ...values, organization_id: ctx.organizationId, created_by: ctx.user.id }).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "skill.created", entityType: "skill", entityId: data.id });
  revalidatePath("/skills"); redirect(`/skills/${data.id}`);
}

export async function updateSkill(form: FormData) {
  const ctx = await requireContext(); const id = String(form.get("id") ?? ""); const values = parseSkill(form);
  const { error } = await ctx.supabase.from("skills").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "skill.updated", entityType: "skill", entityId: id });
  revalidatePath("/skills"); revalidatePath(`/skills/${id}`);
}

export async function archiveSkill(form: FormData) {
  const ctx = await requireContext(); const id = String(form.get("id") ?? "");
  const { error } = await ctx.supabase.from("skills").update({ status: "disabled", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id).eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "skill.archived", entityType: "skill", entityId: id });
  revalidatePath("/skills"); redirect("/skills");
}

export async function assignAgentSkill(form: FormData) {
  const ctx = await requireContext(); const agentId = String(form.get("agentId") ?? ""); const skillId = String(form.get("skillId") ?? "");
  const { error } = await ctx.supabase.from("agent_skills").insert({ agent_id: agentId, skill_id: skillId, organization_id: ctx.organizationId, assigned_by: ctx.user.id });
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "agent.skill_assigned", entityType: "agent", entityId: agentId, metadata: { skillId } });
  revalidatePath(`/agents/${agentId}`); revalidatePath("/skills");
}

export async function removeAgentSkill(form: FormData) {
  const ctx = await requireContext(); const agentId = String(form.get("agentId") ?? ""); const skillId = String(form.get("skillId") ?? "");
  const { error } = await ctx.supabase.from("agent_skills").delete().eq("agent_id", agentId).eq("skill_id", skillId).eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "agent.skill_removed", entityType: "agent", entityId: agentId, metadata: { skillId } });
  revalidatePath(`/agents/${agentId}`); revalidatePath("/skills");
}

async function createCrmRecord(table:"companies"|"contacts"|"leads"|"opportunities",entityType:string,values:Record<string,unknown>,ctx:Awaited<ReturnType<typeof requireContext>>){
  const {data,error}=await ctx.supabase.from(table).insert({...values,organization_id:ctx.organizationId,created_by:ctx.user.id}).select("id").single();
  if(error)throw new Error(error.message); await writeAudit(ctx.supabase,{organizationId:ctx.organizationId,actorId:ctx.user.id,eventType:`crm.${entityType}.created`,entityType,entityId:data.id}); revalidatePath("/crm");revalidatePath(`/crm/${table}`);redirect(`/crm/${table}/${data.id}`);
}
async function updateCrmRecord(table:"companies"|"contacts"|"leads"|"opportunities",entityType:string,form:FormData,values:Record<string,unknown>,ctx:Awaited<ReturnType<typeof requireContext>>){
  const id=String(form.get("id")??"");const {error}=await ctx.supabase.from(table).update({...values,updated_at:new Date().toISOString()}).eq("id",id).eq("organization_id",ctx.organizationId);if(error)throw new Error(error.message);await writeAudit(ctx.supabase,{organizationId:ctx.organizationId,actorId:ctx.user.id,eventType:`crm.${entityType}.updated`,entityType,entityId:id});revalidatePath("/crm");revalidatePath(`/crm/${table}`);revalidatePath(`/crm/${table}/${id}`);
}
async function archiveCrmRecord(table:"companies"|"contacts"|"leads"|"opportunities",entityType:string,form:FormData,ctx:Awaited<ReturnType<typeof requireContext>>){
  const id=String(form.get("id")??"");const {error}=await ctx.supabase.from(table).update({archived_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",id).eq("organization_id",ctx.organizationId);if(error)throw new Error(error.message);await writeAudit(ctx.supabase,{organizationId:ctx.organizationId,actorId:ctx.user.id,eventType:`crm.${entityType}.archived`,entityType,entityId:id});revalidatePath("/crm");revalidatePath(`/crm/${table}`);redirect(`/crm/${table}`);
}

export async function createCompany(form:FormData){const ctx=await requireContext();return createCrmRecord("companies","company",parseCompany(form),ctx);} export async function updateCompany(form:FormData){const ctx=await requireContext();return updateCrmRecord("companies","company",form,parseCompany(form),ctx);} export async function archiveCompany(form:FormData){const ctx=await requireContext();return archiveCrmRecord("companies","company",form,ctx);}
export async function createContact(form:FormData){const ctx=await requireContext();return createCrmRecord("contacts","contact",parseContact(form),ctx);} export async function updateContact(form:FormData){const ctx=await requireContext();return updateCrmRecord("contacts","contact",form,parseContact(form),ctx);} export async function archiveContact(form:FormData){const ctx=await requireContext();return archiveCrmRecord("contacts","contact",form,ctx);}
export async function createLead(form:FormData){const ctx=await requireContext();return createCrmRecord("leads","lead",parseLead(form),ctx);} export async function updateLead(form:FormData){const ctx=await requireContext();return updateCrmRecord("leads","lead",form,parseLead(form),ctx);} export async function archiveLead(form:FormData){const ctx=await requireContext();return archiveCrmRecord("leads","lead",form,ctx);}
export async function createOpportunity(form:FormData){const ctx=await requireContext();return createCrmRecord("opportunities","opportunity",parseOpportunity(form),ctx);} export async function updateOpportunity(form:FormData){const ctx=await requireContext();return updateCrmRecord("opportunities","opportunity",form,parseOpportunity(form),ctx);} export async function archiveOpportunity(form:FormData){const ctx=await requireContext();return archiveCrmRecord("opportunities","opportunity",form,ctx);}

export async function createCrmActivity(form:FormData){const ctx=await requireContext();const values=parseCrmActivity(form);const {data,error}=await ctx.supabase.from("crm_activities").insert({...values,organization_id:ctx.organizationId,created_by_user_id:ctx.user.id}).select("id").single();if(error)throw new Error(error.message);await writeAudit(ctx.supabase,{organizationId:ctx.organizationId,actorId:ctx.user.id,eventType:"crm.activity.created",entityType:"crm_activity",entityId:data.id});revalidatePath("/crm");for(const [key,path] of [["companyId","companies"],["contactId","contacts"],["leadId","leads"],["opportunityId","opportunities"]]){const id=String(form.get(key)??"");if(id)revalidatePath(`/crm/${path}/${id}`);}}

export async function createTask(form: FormData) {
  const ctx = await requireContext(); const values = parseTask(form);
  const { data, error } = await ctx.supabase.from("tasks").insert({ ...values, organization_id: ctx.organizationId, requested_by: ctx.user.id }).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: "task.created", entityType: "task", entityId: data.id, metadata: { status: "queued" } });
  revalidatePath("/tasks"); redirect("/tasks");
}

async function resolveApproval(form: FormData, next: ApprovalStatus) {
  const ctx = await requireContext(); const id = String(form.get("id") ?? "");
  const { data: approval, error: readError } = await ctx.supabase.from("approvals").select("status").eq("id", id).eq("organization_id", ctx.organizationId).single();
  if (readError) throw new Error(readError.message); assertApprovalResolution(approval.status, next);
  const { error } = await ctx.supabase.from("approvals").update({ status: next, resolved_at: new Date().toISOString(), resolved_by: ctx.user.id, resolution_note: String(form.get("note") ?? "").slice(0, 1000) }).eq("id", id).eq("status", "pending");
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, { organizationId: ctx.organizationId, actorId: ctx.user.id, eventType: `approval.${next}`, entityType: "approval", entityId: id });
  revalidatePath("/approvals");
}

export async function approveApproval(form: FormData) { return resolveApproval(form, "approved"); }
export async function rejectApproval(form: FormData) { return resolveApproval(form, "rejected"); }
export async function cancelApproval(form: FormData) { return resolveApproval(form, "cancelled"); }

export async function signOut() { const { supabase } = await requireContext(); await supabase.auth.signOut(); redirect("/login"); }
