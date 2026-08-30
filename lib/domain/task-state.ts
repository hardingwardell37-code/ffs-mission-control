import type { TaskStatus } from "../../types/domain";

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  draft: ["queued", "cancelled"],
  queued: ["running", "blocked", "cancelled"],
  running: ["blocked", "awaiting_approval", "completed", "failed", "cancelled"],
  blocked: ["queued", "cancelled"],
  awaiting_approval: ["running", "blocked", "completed", "cancelled"],
  completed: [], failed: [], cancelled: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus) {
  return transitions[from].includes(to);
}

export function assertTaskCompletionAllowed(status: TaskStatus, approvalStatuses: readonly string[]) {
  if (approvalStatuses.includes("pending") || (approvalStatuses.length > 0 && !approvalStatuses.includes("approved"))) throw new Error("Task approval is unresolved");
  assertTaskTransition(status, "completed");
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus) {
  if (!canTransitionTask(from, to)) throw new Error(`Invalid task transition: ${from} -> ${to}`);
}
