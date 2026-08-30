export type LeadMode = "EXECUTE" | "DELEGATE" | "RECOMMEND" | "CHALLENGE" | "CLARIFY" | "REQUIRE_APPROVAL" | "REFUSE";

export type LeadIntent =
  | { kind: "read_approvals" }
  | { kind: "read_agent_work"; agentQuery: string }
  | { kind: "read_completed" }
  | { kind: "read_failed" }
  | { kind: "create_task"; agentQuery: string; title: string; prompt: string }
  | { kind: "handoff"; taskQuery: string; agentQuery: string }
  | { kind: "advance_workflow"; taskQuery: string }
  | { kind: "challenge"; reason: string }
  | { kind: "clarify"; question: string }
  | { kind: "approval_required"; action: string }
  | { kind: "refuse"; reason: string };

const clean = (value: string) => value.trim().replace(/[.?!]+$/, "").trim();

export function parseLeadCommand(raw: string): LeadIntent {
  const command = clean(raw.slice(0, 500));
  const lower = command.toLowerCase();

  if (!command) return { kind: "clarify", question: "Enter a bounded operational command." };
  if (/\b(delete|purge|wipe|erase)\b.*\b(crm|lead|contact|customer|database|record)/i.test(command)) {
    return { kind: "refuse", reason: "Destructive CRM or database commands are outside this command layer." };
  }
  if (/\b(launch|send|publish|post|deploy)\b.*\b(now|immediately|live|production)?\b/i.test(command)) {
    return lower.includes("approved")
      ? { kind: "approval_required", action: command }
      : { kind: "challenge", reason: "External execution needs a defined target, evidence, and governed approval." };
  }
  if (/\b(make|improve|fix|handle|optimi[sz]e)\b.*\b(better|everything|it|things)\b/i.test(command)) {
    return { kind: "clarify", question: "Specify the work item, desired outcome, and responsible agent." };
  }
  if (/\b(waiting|pending|needs?)\b.*\bapproval/i.test(command) || /\bapproval(s)?\b.*\b(waiting|pending)/i.test(command)) return { kind: "read_approvals" };
  if (/\b(completed|finished)\b.*\b(work|task|recent)/i.test(command) || /\bwhat\b.*\b(completed|finished)/i.test(command)) return { kind: "read_completed" };
  if (/\b(failed|errors?)\b.*\b(recent|task|work)/i.test(command) || /\bwhat\b.*\bfailed/i.test(command)) return { kind: "read_failed" };

  const agentWork = command.match(/(?:what is|show)\s+(.+?)\s+(?:working on|doing)/i);
  if (agentWork) return { kind: "read_agent_work", agentQuery: clean(agentWork[1]) };

  const createFor = command.match(/^(?:create|queue)\s+(?:a\s+)?(.+?)\s+task\s+for\s+(.+)$/i);
  if (createFor) return { kind: "create_task", title: clean(createFor[1]), agentQuery: clean(createFor[2]), prompt: clean(createFor[1]) };
  const havePrepare = command.match(/^have\s+(.+?)\s+(?:prepare|create|draft|research)\s+(.+)$/i);
  if (havePrepare) return { kind: "create_task", agentQuery: clean(havePrepare[1]), title: clean(havePrepare[2]), prompt: `${clean(havePrepare[2])}.` };

  const handoff = command.match(/^(?:hand\s*off|delegate)\s+(.+?)\s+to\s+(.+)$/i);
  if (handoff) return { kind: "handoff", taskQuery: clean(handoff[1]), agentQuery: clean(handoff[2]) };
  const workflow = command.match(/^(?:advance|run|continue)\s+(?:the\s+)?workflow\s+for\s+(.+)$/i);
  if (workflow) return { kind: "advance_workflow", taskQuery: clean(workflow[1]) };

  return { kind: "clarify", question: "I can inspect operations, create a bounded internal task, or hand off a running task. Specify one of those outcomes." };
}

export function modeForIntent(intent: LeadIntent): LeadMode {
  if (intent.kind.startsWith("read_")) return "RECOMMEND";
  if (intent.kind === "create_task") return "EXECUTE";
  if (intent.kind === "handoff") return "DELEGATE";
  if (intent.kind === "advance_workflow") return "EXECUTE";
  if (intent.kind === "challenge") return "CHALLENGE";
  if (intent.kind === "approval_required") return "REQUIRE_APPROVAL";
  if (intent.kind === "refuse") return "REFUSE";
  return "CLARIFY";
}

export const isReadIntent = (intent: LeadIntent) => intent.kind.startsWith("read_");
export const previewAllowsIntent = (intent: LeadIntent) => isReadIntent(intent) || ["challenge", "clarify", "approval_required", "refuse"].includes(intent.kind);
