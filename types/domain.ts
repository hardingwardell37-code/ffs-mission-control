export type AgentStatus = "draft" | "active" | "paused" | "disabled";
export type TaskStatus = "draft" | "queued" | "running" | "blocked" | "awaiting_approval" | "completed" | "failed" | "cancelled";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

export type CampaignStatus = "draft" | "active" | "paused" | "archived";
export type CampaignEntryMode = "research" | "product_url" | "upload" | "hybrid";
export type AssetRole = "source" | "reference" | "locked" | "generated";
export type AssetOwnership = "owned" | "licensed" | "generated" | "unknown";
export type AssetApprovalState = "draft" | "pending" | "approved" | "rejected" | "locked";
export type AssetOrigin = "upload" | "url" | "generated" | "import";

export type CampaignApprovalActionKey =
  | "campaign_concept"
  | "campaign_storyboard"
  | "campaign_assets"
  | "campaign_editorial"
  | "campaign_final_master"
  | "campaign_export";

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  purpose: string;
  status: AgentStatus;
  modelProvider: string;
  modelName: string;
  systemInstructions: string;
  maxRuntimeSeconds: number;
}

export interface ToolPermission {
  toolKey: string;
  canRead: boolean;
  canWrite: boolean;
  requiresApproval: boolean;
}

export interface Task {
  id: string;
  agentId: string;
  title: string;
  input: unknown;
  status: TaskStatus;
  requestedBy: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  status: CampaignStatus;
  entryMode: CampaignEntryMode;
  brief: string;
  productUrl: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type GenerationProviderId =
  | "openai_image"
  | "google_omni"
  | "fal_minimax_h3"
  | "fal_minimax_h3_max"
  | "grok_imagine"
  | "runway"
  | "auto";

export type GenerationModality = "image" | "video";

export type GenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface GenerationJob {
  id: string;
  organizationId: string;
  campaignId: string;
  createdBy: string | null;
  modality: GenerationModality;
  provider: GenerationProviderId;
  modelName: string | null;
  status: GenerationJobStatus;
  prompt: string;
  negativePrompt: string;
  settings: Record<string, unknown>;
  referenceAssetIds: string[];
  lockedAssetIds: string[];
  resultAssetId: string | null;
  errorMessage: string | null;
  costCents: number | null;
  externalJobId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type StudioJobSource =
  | "upwork"
  | "fiverr"
  | "contra"
  | "email"
  | "intake"
  | "other";

export type StudioJobStatus =
  | "new"
  | "needs_review"
  | "approved"
  | "generating"
  | "qa"
  | "delivered"
  | "rejected";

export type StudioJobDecision = "accept" | "review" | "reject";

export type JobWorkflowApprovalStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected";

export type JobRevisionApprovalStatus = JobWorkflowApprovalStatus;

export type StudioJobApprovalActionKey =
  | "job_workflow"
  | "job_budget"
  | "job_rights"
  | "job_delivery";

export interface StudioJob {
  id: string;
  organizationId: string;
  campaignId: string | null;
  createdBy: string | null;
  title: string;
  source: StudioJobSource;
  rawBrief: string;
  clientNotes: string;
  clientBudgetCents: number | null;
  quotedPriceCents: number | null;
  maxProductionBudgetCents: number | null;
  channelFeeBps: number;
  contingencyBps: number;
  deadline: string | null;
  status: StudioJobStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BriefAnalysis {
  id: string;
  studioJobId: string;
  organizationId: string;
  deliverables: unknown[];
  dimensions: unknown[];
  durations: unknown[];
  references: unknown[];
  exactText: unknown[];
  brandConstraints: unknown[];
  rightsConcerns: unknown[];
  missingInformation: unknown[];
  confidence: number | null;
  decision: StudioJobDecision;
  rationale: string;
  modelUsed: string;
  analysisJson: Record<string, unknown>;
  createdAt: string;
}

export interface JobWorkflowStep {
  order: number;
  modality: string;
  provider: string;
  model: string;
  purpose: string;
  inputs: unknown;
  expectedOutputs: unknown;
  estimatedAttempts: number;
  unitCostCents: number;
  estimatedTotalCents: number;
}

export interface JobWorkflow {
  id: string;
  studioJobId: string;
  organizationId: string;
  steps: JobWorkflowStep[] | unknown[];
  estimatedTotalCostCents: number | null;
  approvalStatus: JobWorkflowApprovalStatus;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobRevision {
  id: string;
  studioJobId: string;
  organizationId: string;
  clientNote: string;
  affectedDeliverable: string;
  recommendedAction: string;
  expectedIncrementalCostCents: number | null;
  approvalStatus: JobRevisionApprovalStatus;
  createdAt: string;
  updatedAt: string;
}
