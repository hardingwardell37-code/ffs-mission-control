import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  JobRevisionApprovalStatus,
  JobWorkflowApprovalStatus,
  StudioJobDecision,
  StudioJobSource,
  StudioJobStatus,
} from "../../types/domain";

export type CreateStudioJobInput = {
  organizationId: string;
  createdBy: string;
  title: string;
  rawBrief: string;
  source?: StudioJobSource;
  clientNotes?: string;
  campaignId?: string | null;
  clientBudgetCents?: number | null;
  quotedPriceCents?: number | null;
  maxProductionBudgetCents?: number | null;
  channelFeeBps?: number;
  contingencyBps?: number;
  deadline?: string | null;
  status?: StudioJobStatus;
};

export type UpsertBriefAnalysisInput = {
  studioJobId: string;
  organizationId: string;
  deliverables?: unknown[];
  dimensions?: unknown[];
  durations?: unknown[];
  references?: unknown[];
  exactText?: unknown[];
  brandConstraints?: unknown[];
  rightsConcerns?: unknown[];
  missingInformation?: unknown[];
  confidence?: number | null;
  decision?: StudioJobDecision;
  rationale?: string;
  modelUsed?: string;
  analysisJson?: Record<string, unknown>;
};

export type UpsertJobWorkflowInput = {
  studioJobId: string;
  organizationId: string;
  steps?: unknown[];
  estimatedTotalCostCents?: number | null;
  approvalStatus?: JobWorkflowApprovalStatus;
  approvedAt?: string | null;
  approvedBy?: string | null;
};

export type AddJobRevisionInput = {
  studioJobId: string;
  organizationId: string;
  clientNote: string;
  affectedDeliverable?: string;
  recommendedAction?: string;
  expectedIncrementalCostCents?: number | null;
  approvalStatus?: JobRevisionApprovalStatus;
};

function throwOnError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function createStudioJob(supabase: SupabaseClient, input: CreateStudioJobInput) {
  const { data, error } = await supabase
    .from("studio_jobs")
    .insert({
      organization_id: input.organizationId,
      created_by: input.createdBy,
      title: input.title,
      raw_brief: input.rawBrief,
      source: input.source ?? "other",
      client_notes: input.clientNotes ?? "",
      campaign_id: input.campaignId ?? null,
      client_budget_cents: input.clientBudgetCents ?? null,
      quoted_price_cents: input.quotedPriceCents ?? null,
      max_production_budget_cents: input.maxProductionBudgetCents ?? null,
      channel_fee_bps: input.channelFeeBps ?? 0,
      contingency_bps: input.contingencyBps ?? 1000,
      deadline: input.deadline ?? null,
      status: input.status ?? "new",
    })
    .select("*")
    .single();
  throwOnError(error);
  return data;
}

export async function getStudioJob(
  supabase: SupabaseClient,
  organizationId: string,
  studioJobId: string,
) {
  const { data, error } = await supabase
    .from("studio_jobs")
    .select("*")
    .eq("id", studioJobId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  throwOnError(error);
  return data;
}

export async function listStudioJobsByStatus(
  supabase: SupabaseClient,
  organizationId: string,
  status?: StudioJobStatus,
) {
  let query = supabase
    .from("studio_jobs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  throwOnError(error);
  return data ?? [];
}

export async function upsertBriefAnalysis(supabase: SupabaseClient, input: UpsertBriefAnalysisInput) {
  const row = {
    studio_job_id: input.studioJobId,
    organization_id: input.organizationId,
    deliverables: input.deliverables ?? [],
    dimensions: input.dimensions ?? [],
    durations: input.durations ?? [],
    references: input.references ?? [],
    exact_text: input.exactText ?? [],
    brand_constraints: input.brandConstraints ?? [],
    rights_concerns: input.rightsConcerns ?? [],
    missing_information: input.missingInformation ?? [],
    confidence: input.confidence ?? null,
    decision: input.decision ?? "review",
    rationale: input.rationale ?? "",
    model_used: input.modelUsed ?? "mock",
    analysis_json: input.analysisJson ?? {},
  };
  const { data, error } = await supabase
    .from("brief_analyses")
    .upsert(row, { onConflict: "studio_job_id" })
    .select("*")
    .single();
  throwOnError(error);
  return data;
}

export async function upsertJobWorkflow(supabase: SupabaseClient, input: UpsertJobWorkflowInput) {
  const row = {
    studio_job_id: input.studioJobId,
    organization_id: input.organizationId,
    steps: input.steps ?? [],
    estimated_total_cost_cents: input.estimatedTotalCostCents ?? null,
    approval_status: input.approvalStatus ?? "draft",
    approved_at: input.approvedAt ?? null,
    approved_by: input.approvedBy ?? null,
  };
  const { data, error } = await supabase
    .from("job_workflows")
    .upsert(row, { onConflict: "studio_job_id" })
    .select("*")
    .single();
  throwOnError(error);
  return data;
}

export async function addJobRevision(supabase: SupabaseClient, input: AddJobRevisionInput) {
  const { data, error } = await supabase
    .from("job_revisions")
    .insert({
      studio_job_id: input.studioJobId,
      organization_id: input.organizationId,
      client_note: input.clientNote,
      affected_deliverable: input.affectedDeliverable ?? "",
      recommended_action: input.recommendedAction ?? "",
      expected_incremental_cost_cents: input.expectedIncrementalCostCents ?? null,
      approval_status: input.approvalStatus ?? "draft",
    })
    .select("*")
    .single();
  throwOnError(error);
  return data;
}
