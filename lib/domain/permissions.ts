import type { ToolPermission } from "../../types/domain";

export type ToolAction = "read" | "write";

export function evaluateToolPermission(permission: ToolPermission | undefined, action: ToolAction) {
  if (!permission) return { allowed: false, requiresApproval: false, reason: "Tool is not granted" };
  const allowed = action === "read" ? permission.canRead : permission.canWrite;
  return { allowed, requiresApproval: allowed && action === "write" && permission.requiresApproval, reason: allowed ? null : `${action} is denied` };
}
