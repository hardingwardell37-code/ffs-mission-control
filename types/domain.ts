export type AgentStatus = "draft" | "active" | "paused" | "disabled";
export type TaskStatus = "draft" | "queued" | "running" | "blocked" | "awaiting_approval" | "completed" | "failed" | "cancelled";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "cancelled" | "expired";

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
