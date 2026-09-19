"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { parseAgent, parseAsset, parseCampaign, parseCampaignBrief, parseCampaignDna, parseResearchSource, parseTask } from "@/lib/validation";
import { assertApprovalResolution } from "@/lib/domain/approval";
import { defaultSectionForRole } from "@/lib/domain/campaign";
import type { ApprovalStatus, AssetRole } from "@/types/domain";
import { BYPASS_COOKIE } from "@/lib/studio-bypass";
import { createClient } from "@/lib/supabase/server";

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

export async function signOut() {
  const store = await cookies();
  store.delete(BYPASS_COOKIE);
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Configuration may be incomplete; clearing the bypass cookie is enough to leave.
  }
  redirect("/login");
}

export async function createCampaign(form: FormData) {
  const ctx = await requireContext();
  const values = parseCampaign(form);
  const { data, error } = await ctx.supabase.from("campaigns").insert({
    ...values,
    organization_id: ctx.organizationId,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "campaign.created",
    entityType: "campaign",
    entityId: data.id,
    metadata: { entryMode: values.entry_mode, slug: values.slug },
  });
  revalidatePath("/campaigns");
  redirect(`/campaigns/${data.id}`);
}

export async function updateCampaignBrief(form: FormData) {
  const ctx = await requireContext();
  const id = String(form.get("campaignId") ?? "");
  if (!id) throw new Error("Campaign is required");
  const values = parseCampaignBrief(form);
  const patch: Record<string, unknown> = { brief: values.brief, product_url: values.product_url };
  if (values.status) patch.status = values.status;
  const { error } = await ctx.supabase.from("campaigns").update(patch).eq("id", id).eq("organization_id", ctx.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "campaign.brief_updated",
    entityType: "campaign",
    entityId: id,
  });
  revalidatePath(`/campaigns/${id}`);
}

export async function updateCampaignDna(form: FormData) {
  const ctx = await requireContext();
  const id = String(form.get("campaignId") ?? "");
  if (!id) throw new Error("Campaign is required");
  const values = parseCampaignDna(form);
  const { data: campaign } = await ctx.supabase.from("campaigns").select("id").eq("id", id).eq("organization_id", ctx.organizationId).maybeSingle();
  if (!campaign) throw new Error("Campaign not found");
  const { error } = await ctx.supabase.from("campaign_dna").upsert({
    campaign_id: id,
    organization_id: ctx.organizationId,
    ...values,
    updated_at: new Date().toISOString(),
    updated_by: ctx.user.id,
  }, { onConflict: "campaign_id" });
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "campaign.dna_updated",
    entityType: "campaign",
    entityId: id,
  });
  revalidatePath(`/campaigns/${id}`);
}

export async function addResearchSource(form: FormData) {
  const ctx = await requireContext();
  const campaignId = String(form.get("campaignId") ?? "");
  if (!campaignId) throw new Error("Campaign is required");
  const values = parseResearchSource(form);
  const { data: campaign } = await ctx.supabase.from("campaigns").select("id").eq("id", campaignId).eq("organization_id", ctx.organizationId).maybeSingle();
  if (!campaign) throw new Error("Campaign not found");
  const { data, error } = await ctx.supabase.from("research_sources").insert({
    ...values,
    campaign_id: campaignId,
    organization_id: ctx.organizationId,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "campaign.research_added",
    entityType: "research_source",
    entityId: data.id,
    metadata: { campaignId, url: values.url },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

export async function registerAsset(form: FormData) {
  const ctx = await requireContext();
  const campaignId = String(form.get("campaignId") ?? "");
  if (!campaignId) throw new Error("Campaign is required");
  const values = parseAsset(form);
  const { data: campaign } = await ctx.supabase.from("campaigns").select("id").eq("id", campaignId).eq("organization_id", ctx.organizationId).maybeSingle();
  if (!campaign) throw new Error("Campaign not found");
  const section = values.section || defaultSectionForRole(values.role as AssetRole);
  const { data, error } = await ctx.supabase.from("assets").insert({
    campaign_id: campaignId,
    organization_id: ctx.organizationId,
    title: values.title,
    role: values.role,
    section,
    mime_type: values.mime_type,
    storage_path: values.storage_path,
    storage_url: values.storage_url,
    file_size: values.file_size,
    ownership_status: values.ownership_status,
    source_url: values.source_url,
    origin: values.origin,
    parent_asset_id: values.parent_asset_id,
    usage_notes: values.usage_notes,
    model_provider: values.model_provider,
    model_name: values.model_name,
    prompt: values.prompt,
    created_by: ctx.user.id,
  }).select("id").single();
  if (error) throw new Error(error.message);
  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "campaign.asset_registered",
    entityType: "asset",
    entityId: data.id,
    metadata: {
      campaignId,
      role: values.role,
      ownership: values.ownership_status,
      origin: values.origin,
      storagePath: values.storage_path,
    },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}
