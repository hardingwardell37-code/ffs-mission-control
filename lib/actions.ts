"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { parseAgent, parseAsset, parseCampaign, parseCampaignBrief, parseCampaignDna, parseGenerationJob, parseResearchSource, parseTask } from "@/lib/validation";
import { assertApprovalResolution } from "@/lib/domain/approval";
import { defaultSectionForModality, defaultSectionForRole } from "@/lib/domain/campaign";
import { runGenerationRequest } from "@/lib/generation";
import type { GenerationModality } from "@/types/domain";
import type { ApprovalStatus, AssetRole } from "@/types/domain";
import { BYPASS_COOKIE } from "@/lib/studio-bypass";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchRemoteMedia,
  uploadGeneratedBytes,
} from "@/lib/storage/campaign-assets";

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


async function assertCampaignAssets(
  supabase: Awaited<ReturnType<typeof requireContext>>["supabase"],
  organizationId: string,
  campaignId: string,
  assetIds: string[],
  label: string,
) {
  if (!assetIds.length) return;
  const { data, error } = await supabase
    .from("assets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .in("id", assetIds);
  if (error) throw new Error(error.message);
  if ((data?.length ?? 0) !== assetIds.length) {
    throw new Error(`${label} must belong to this campaign`);
  }
}

export async function createGenerationJob(form: FormData) {
  const ctx = await requireContext();
  const campaignId = String(form.get("campaignId") ?? "");
  if (!campaignId) throw new Error("Campaign is required");
  const values = parseGenerationJob(form);

  const { data: campaign } = await ctx.supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!campaign) throw new Error("Campaign not found");

  await assertCampaignAssets(ctx.supabase, ctx.organizationId, campaignId, values.reference_asset_ids, "Reference assets");
  await assertCampaignAssets(ctx.supabase, ctx.organizationId, campaignId, values.locked_asset_ids, "Locked assets");

  const { data, error } = await ctx.supabase.from("generation_jobs").insert({
    organization_id: ctx.organizationId,
    campaign_id: campaignId,
    created_by: ctx.user.id,
    modality: values.modality,
    provider: values.provider,
    model_name: values.model_name,
    status: "queued",
    prompt: values.prompt,
    negative_prompt: values.negative_prompt,
    settings: values.settings,
    reference_asset_ids: values.reference_asset_ids,
    locked_asset_ids: values.locked_asset_ids,
  }).select("id").single();
  if (error) throw new Error(error.message);

  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "generation.job_created",
    entityType: "generation_job",
    entityId: data.id,
    metadata: {
      campaignId,
      modality: values.modality,
      provider: values.provider,
      referenceCount: values.reference_asset_ids.length,
      lockedCount: values.locked_asset_ids.length,
    },
  });

  const runNow = form.get("runNow") === "on" || form.get("runNow") === "true" || form.get("runNow") === "1";
  if (runNow) {
    await runGenerationJobInternal(ctx, data.id);
  }

  revalidatePath(`/campaigns/${campaignId}`);
  return data.id;
}

async function runGenerationJobInternal(
  ctx: Awaited<ReturnType<typeof requireContext>>,
  jobId: string,
) {
  const { data: job, error: readError } = await ctx.supabase
    .from("generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!job) throw new Error("Generation job not found");
  if (job.status === "cancelled") throw new Error("Job was cancelled");
  if (job.status === "succeeded") return;
  if (job.status === "running") throw new Error("Job is already running");

  const startedAt = new Date().toISOString();
  const { error: claimError } = await ctx.supabase
    .from("generation_jobs")
    .update({ status: "running", started_at: startedAt, error_message: null })
    .eq("id", jobId)
    .eq("organization_id", ctx.organizationId)
    .in("status", ["queued", "failed"]);
  if (claimError) throw new Error(claimError.message);

  const refIds: string[] = job.reference_asset_ids ?? [];
  let referenceUrls: string[] = [];
  if (refIds.length) {
    const { data: refs } = await ctx.supabase
      .from("assets")
      .select("id,storage_url,source_url")
      .eq("campaign_id", job.campaign_id)
      .eq("organization_id", ctx.organizationId)
      .in("id", refIds);
    referenceUrls = (refs ?? [])
      .map((r) => r.storage_url || r.source_url)
      .filter((u): u is string => Boolean(u));
  }

  const result = await runGenerationRequest({
    jobId: job.id,
    organizationId: ctx.organizationId,
    campaignId: job.campaign_id,
    modality: job.modality as GenerationModality,
    provider: job.provider,
    modelName: job.model_name,
    prompt: job.prompt,
    negativePrompt: job.negative_prompt,
    settings: (job.settings as Record<string, unknown>) ?? {},
    referenceAssetIds: refIds,
    lockedAssetIds: job.locked_asset_ids ?? [],
    referenceUrls,
  });

  const completedAt = new Date().toISOString();

  if (!result.ok) {
    await ctx.supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: `[${result.code}] ${result.message}`,
        external_job_id: result.externalJobId ?? null,
        completed_at: completedAt,
        provider: result.resolvedProvider ?? job.provider,
      })
      .eq("id", jobId)
      .eq("organization_id", ctx.organizationId);
    await writeAudit(ctx.supabase, {
      organizationId: ctx.organizationId,
      actorId: ctx.user.id,
      eventType: "generation.job_failed",
      entityType: "generation_job",
      entityId: jobId,
      metadata: { code: result.code, message: result.message },
    });
    return;
  }

  const modality = job.modality as GenerationModality;
  const section = defaultSectionForModality(modality);
  const title = `Generated ${modality} · ${new Date().toISOString().slice(0, 16)}`;
  let mimeType = result.mimeType ?? (modality === "video" ? "video/mp4" : "image/png");

  let storagePath: string | null = null;
  let storageUrl: string | null = null;
  let durableUpload = false;
  const remoteFallbackUrl: string | null = result.resultUrl ?? null;
  let fileSize: number | null = result.resultBytes?.length ?? null;

  async function persistBytes(bytes: Uint8Array, contentType: string) {
    const tryUpload = async (client: typeof ctx.supabase) =>
      uploadGeneratedBytes(client, {
        campaignId: job.campaign_id,
        jobId: job.id,
        bytes,
        mimeType: contentType,
      });

    try {
      return await tryUpload(ctx.supabase);
    } catch (firstErr) {
      try {
        const admin = createAdminClient();
        return await tryUpload(admin as unknown as typeof ctx.supabase);
      } catch {
        throw firstErr instanceof Error ? firstErr : new Error("Storage upload failed");
      }
    }
  }

  if (result.resultBytes && result.resultBytes.length) {
    try {
      const uploaded = await persistBytes(result.resultBytes, mimeType);
      storagePath = uploaded.storagePath;
      storageUrl = uploaded.storageUrl;
      durableUpload = true;
    } catch {
      // Keep going — still register the asset; UI will show no preview URL if nothing else.
      storageUrl = remoteFallbackUrl;
    }
  } else if (result.resultUrl) {
    storageUrl = result.resultUrl;
    const remote = await fetchRemoteMedia(result.resultUrl);
    if (remote?.bytes.length) {
      const remoteMime = remote.mimeType?.split(";")[0]?.trim() || mimeType;
      mimeType = remoteMime;
      try {
        const uploaded = await persistBytes(remote.bytes, remoteMime);
        storagePath = uploaded.storagePath;
        storageUrl = uploaded.storageUrl;
        durableUpload = true;
        fileSize = remote.bytes.length;
      } catch {
        // Provider URL remains as fallback so previews still work until it expires.
        storageUrl = result.resultUrl;
      }
    }
  }

  const { data: asset, error: assetError } = await ctx.supabase.from("assets").insert({
    campaign_id: job.campaign_id,
    organization_id: ctx.organizationId,
    title,
    role: "generated",
    section,
    mime_type: mimeType,
    storage_path: storagePath,
    storage_url: storageUrl,
    file_size: fileSize,
    ownership_status: "generated",
    origin: "generated",
    approval_state: "draft",
    model_provider: result.provider,
    model_name: result.modelName,
    prompt: job.prompt,
    generation_settings: {
      ...(job.settings as object),
      negative_prompt: job.negative_prompt,
      locked_asset_ids: job.locked_asset_ids,
      has_result_bytes: Boolean(result.resultBytes?.length),
      durable_upload: durableUpload,
      remote_fallback_url: durableUpload ? remoteFallbackUrl : null,
    },
    reference_asset_ids: refIds,
    usage_notes: "Generated by F&P Studio Phase 2. Review before approval gates. Do not treat as final master.",
    created_by: ctx.user.id,
  }).select("id").single();

  if (assetError) {
    await ctx.supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: `Provider succeeded but asset create failed: ${assetError.message}`,
        external_job_id: result.externalJobId ?? null,
        completed_at: completedAt,
        provider: result.provider,
        model_name: result.modelName,
      })
      .eq("id", jobId)
      .eq("organization_id", ctx.organizationId);
    throw new Error(assetError.message);
  }

  const { error: doneError } = await ctx.supabase
    .from("generation_jobs")
    .update({
      status: "succeeded",
      result_asset_id: asset.id,
      external_job_id: result.externalJobId ?? null,
      cost_cents: result.costCents ?? null,
      completed_at: completedAt,
      error_message: null,
      provider: result.provider,
      model_name: result.modelName,
    })
    .eq("id", jobId)
    .eq("organization_id", ctx.organizationId);
  if (doneError) throw new Error(doneError.message);

  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "generation.job_succeeded",
    entityType: "generation_job",
    entityId: jobId,
    metadata: {
      campaignId: job.campaign_id,
      assetId: asset.id,
      provider: result.provider,
      modelName: result.modelName,
    },
  });
}

export async function runGenerationJob(form: FormData) {
  const ctx = await requireContext();
  const jobId = String(form.get("jobId") ?? "");
  const campaignId = String(form.get("campaignId") ?? "");
  if (!jobId) throw new Error("Job is required");
  await runGenerationJobInternal(ctx, jobId);
  if (campaignId) revalidatePath(`/campaigns/${campaignId}`);
  else {
    const { data: job } = await ctx.supabase.from("generation_jobs").select("campaign_id").eq("id", jobId).maybeSingle();
    if (job?.campaign_id) revalidatePath(`/campaigns/${job.campaign_id}`);
  }
}

export async function cancelGenerationJob(form: FormData) {
  const ctx = await requireContext();
  const jobId = String(form.get("jobId") ?? "");
  const campaignId = String(form.get("campaignId") ?? "");
  if (!jobId) throw new Error("Job is required");

  const { data: job } = await ctx.supabase
    .from("generation_jobs")
    .select("id,status,campaign_id")
    .eq("id", jobId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!job) throw new Error("Generation job not found");
  if (job.status === "succeeded") throw new Error("Cannot cancel a succeeded job");
  if (job.status === "cancelled") return;

  const { error } = await ctx.supabase
    .from("generation_jobs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      error_message: "Cancelled by user",
    })
    .eq("id", jobId)
    .eq("organization_id", ctx.organizationId)
    .in("status", ["queued", "running", "failed"]);
  if (error) throw new Error(error.message);

  await writeAudit(ctx.supabase, {
    organizationId: ctx.organizationId,
    actorId: ctx.user.id,
    eventType: "generation.job_cancelled",
    entityType: "generation_job",
    entityId: jobId,
    metadata: { campaignId: job.campaign_id },
  });
  revalidatePath(`/campaigns/${campaignId || job.campaign_id}`);
}
