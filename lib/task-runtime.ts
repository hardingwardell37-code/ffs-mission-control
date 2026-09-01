"use server";

import { revalidatePath } from "next/cache";
import { requireWriteContext } from "@/lib/auth";
import type { TaskStatus } from "@/types/domain";

function concise(value: string, name: string, max: number) {
  const text = value.trim();
  if (!text || text.length > max) throw new Error(`${name} is required and must be at most ${max} characters`);
  return text;
}

async function runRpc(name: string, parameters: Record<string, unknown>) {
  const { supabase } = await requireWriteContext();
  const { error } = await supabase.rpc(name, parameters);
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/approvals");
  revalidatePath("/activity");
}

async function transitionTask(taskId: string, next: TaskStatus, summary?: string, output?: Record<string, string>) {
  await runRpc("transition_task_runtime", {
    p_task_id: taskId,
    p_next: next,
    p_summary: summary ?? null,
    p_output: output ?? null,
  });
}

export async function queueTask(taskId: string) {
  return transitionTask(taskId, "queued");
}

export async function startTask(taskId: string) {
  return transitionTask(taskId, "running");
}

export async function blockTask(taskId: string, summary: string) {
  const reason = concise(summary, "Block summary", 500);
  return transitionTask(taskId, "blocked", reason);
}

export async function failTask(taskId: string, summary: string) {
  const reason = concise(summary, "Failure summary", 500);
  return transitionTask(taskId, "failed", reason);
}

export async function cancelTask(taskId: string, summary = "Cancelled by operator") {
  return transitionTask(taskId, "cancelled", concise(summary, "Cancellation summary", 500));
}

export async function requestTaskApproval(taskId: string, actionKey: string, reason: string) {
  return runRpc("request_task_runtime_approval", {
    p_task_id: taskId,
    p_action_key: concise(actionKey, "Action key", 120),
    p_reason: concise(reason, "Approval reason", 1000),
  });
}

export async function handoffTask(taskId: string, destinationAgentId: string, summary: string) {
  return runRpc("record_task_runtime_handoff", {
    p_task_id: taskId,
    p_destination_agent_id: destinationAgentId,
    p_summary: concise(summary, "Handoff summary", 500),
  });
}

export async function completeTask(taskId: string, outputType: string, title: string, summary: string) {
  const timestamp = new Date().toISOString();
  return transitionTask(taskId, "completed", undefined, {
    outputType: concise(outputType, "Output type", 80),
    title: concise(title, "Output title", 180),
    summary: concise(summary, "Output summary", 1000),
    timestamp,
  });
}
