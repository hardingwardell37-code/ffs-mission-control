import type { ApprovalStatus } from "../../types/domain";

export function assertApprovalResolution(current: ApprovalStatus, next: ApprovalStatus) {
  if (current !== "pending") throw new Error("Only pending approvals may be resolved");
  if (!(["approved", "rejected", "cancelled"] as ApprovalStatus[]).includes(next)) {
    throw new Error(`Invalid approval resolution: ${next}`);
  }
}
