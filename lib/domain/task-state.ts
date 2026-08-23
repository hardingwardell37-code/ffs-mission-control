import type { TaskStatus } from "../../types/domain";

const transitions: Record<TaskStatus, readonly TaskStatus[]> = {
  draft: ["queued", "cancelled"],
  queued: ["running", "blocked", "cancelled"],
  running: ["blocked", "awaiting_approval", "completed", "failed", "cancelled"],
  blocked: ["queued", "cancelled"],
  awaiting_approval: ["running", "blocked", "cancelled"],
  completed: [], failed: [], cancelled: [],
};

export function canTransitionTask(from: TaskStatus, to: TaskStatus) {
  return transitions[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus) {
  if (!canTransitionTask(from, to)) throw new Error(`Invalid task transition: ${from} -> ${to}`);
}
