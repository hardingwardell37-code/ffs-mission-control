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
