export type CommunicationSeverity = "info" | "approval" | "warning" | "failure" | "success";
export type AgentCommunication = { id: string; source: string; destination: string | null; task: string | null; eventType: string; summary: string; timestamp: string; severity: CommunicationSeverity };
export type CommunicationEvent = { id: string; event_type: string; entity_id?: string | null; created_at: string; metadata?: Record<string, unknown> | null };
export type CommunicationContext = { agents: Array<{ id: string; name: string }>; tasks: Array<{ id: string; title: string; agent_id: string | null }>; approvals: Array<{ task_id: string; status: string }> };

const text = (value: unknown) => typeof value === "string" ? value : null;
const label = (value: string | null) => value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : null;

export function deriveAgentCommunications(events: CommunicationEvent[], context: CommunicationContext): AgentCommunication[] {
  const agentName = (id: unknown) => context.agents.find((agent) => agent.id === id)?.name ?? null;
  const taskFor = (event: CommunicationEvent) => context.tasks.find((task) => task.id === event.entity_id || task.id === text(event.metadata?.taskId)) ?? null;
  const make = (event: CommunicationEvent, values: Omit<AgentCommunication, "id" | "eventType" | "timestamp" | "task"> & { task?: string | null }): AgentCommunication => ({ id: event.id, eventType: event.event_type, timestamp: event.created_at, task: values.task ?? taskFor(event)?.title ?? null, ...values });

  return events.flatMap((event): AgentCommunication[] => {
    const metadata = event.metadata ?? {};
    const task = taskFor(event);
    const invoking = agentName(metadata.invokingAgentId) ?? agentName(metadata.agentId);
    const destination = agentName(metadata.destinationAgentId) ?? text(metadata.handoffDestination);
    const stage = label(text(metadata.stageKey));
    switch (event.event_type) {
      case "task.created": case "task.queued":
        return [make(event, { source: "Mission Control", destination: task ? agentName(task.agent_id) : null, summary: event.event_type === "task.created" ? "Task assigned and entered operations." : "Task queued for execution.", severity: "info" })];
      case "task.started":
        return [make(event, { source: task ? agentName(task.agent_id) ?? "Assigned agent" : "Assigned agent", destination: null, summary: "Task execution started.", severity: "info" })];
      case "specialist.invoked":
        return [make(event, { source: "Lead Agent", destination: invoking, summary: "Specialist invoked for governed execution.", severity: "info" })];
      case "specialist.recommend":
        return [make(event, { source: invoking ?? "Specialist", destination: "Lead Agent", summary: "Recommendation returned for workflow review.", severity: "info" })];
      case "specialist.challenge":
        return [make(event, { source: invoking ?? "Specialist", destination: "Lead Agent", summary: "Challenge raised; workflow requires review.", severity: "warning" })];
      case "specialist.clarify":
        return [make(event, { source: invoking ?? "Specialist", destination: "Lead Agent", summary: "Clarification requested before work can continue.", severity: "warning" })];
      case "specialist.handoff_completed": case "task.handoff":
        return [make(event, { source: invoking ?? "Mission Control", destination, summary: "Work handoff recorded.", severity: "info" })];
      case "orchestrator.step_invoked":
        return [make(event, { source: "Lead Agent", destination: invoking ?? agentName(metadata.agentId), summary: `${stage ?? "Workflow"} stage started.`, severity: "info" })];
      case "orchestrator.step_result":
        return [make(event, { source: invoking ?? agentName(metadata.agentId) ?? "Specialist", destination: "Lead Agent", summary: stage === "Review" ? "Reviewer result returned." : `${stage ?? "Workflow"} result returned.`, severity: "info" })];
      case "approval.requested": case "specialist.approval_required": case "orchestrator.approval_paused":
        return [make(event, { source: "Lead Agent", destination: "Approver", summary: "Approval required; workflow paused.", severity: "approval" })];
      case "approval.approved": case "orchestrator.approval_resumed":
        return [make(event, { source: "Approver", destination: "Lead Agent", summary: "Approval resolved; workflow may resume.", severity: "success" })];
      case "approval.rejected":
        return [make(event, { source: "Approver", destination: "Lead Agent", summary: "Approval rejected; workflow remains stopped.", severity: "warning" })];
      case "task.blocked": case "specialist.refuse":
        return [make(event, { source: invoking ?? agentName(task?.agent_id) ?? "Lead Agent", destination: "Lead Agent", summary: "Blocker recorded; workflow cannot continue.", severity: "warning" })];
      case "task.failed":
        return [make(event, { source: agentName(task?.agent_id) ?? "Mission Control", destination: "Lead Agent", summary: "Task failed; operator review required.", severity: "failure" })];
      case "task.completed": case "orchestrator.completed":
        return [make(event, { source: agentName(task?.agent_id) ?? "Lead Agent", destination: "Mission Control", summary: "Workflow completed and output recorded.", severity: "success" })];
      case "orchestrator.stopped":
        return [make(event, { source: "Lead Agent", destination: null, summary: "Workflow stopped by governance controls.", severity: "warning" })];
      default:
        return [];
    }
  });
}
