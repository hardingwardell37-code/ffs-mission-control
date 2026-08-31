import { OperationsCanvas, type OperationAgent, type OperationApproval, type OperationEvent, type OperationTask } from "@/components/operations-canvas";
import { requireContext } from "@/lib/auth";
import { deriveAgentCommunications } from "@/lib/domain/agent-communications";

export default async function HomePage() {
  const { supabase, organizationId, previewMode } = await requireContext();
  const taskFields = previewMode ? "id,agent_id,title,status,created_at,started_at,finished_at,agents(name)" : "id,agent_id,title,status,created_at,started_at,finished_at,output,error_message,agents(name)";
  const agentFields = previewMode ? "id,name,status,department" : "id,name,purpose,status,updated_at,department,agent_skills(count)";
  const approvalFields = previewMode ? "id,task_id,action_key,status,requested_at,tasks(title,agent_id,agents(name))" : "id,task_id,action_key,reason,status,requested_at,tasks(title,agent_id,agents(name))";
  const auditFields = "id,event_type,entity_type,entity_id,created_at,metadata";
  const [tasksResult, agentsResult, approvalsResult, auditResult] = await Promise.all([
    supabase.from("tasks").select(taskFields).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    supabase.from("agents").select(agentFields).eq("organization_id", organizationId).is("archived_at", null).order("updated_at", { ascending: false }).limit(20),
    supabase.from("approvals").select(approvalFields).eq("organization_id", organizationId).order("requested_at", { ascending: false }).limit(12),
    supabase.from("audit_events").select(auditFields).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(16),
  ]);

  const tasks = (tasksResult.data ?? []) as unknown as OperationTask[];
  const agents = (agentsResult.data ?? []) as unknown as OperationAgent[];
  const approvals = (approvalsResult.data ?? []) as unknown as OperationApproval[];
  const events = (auditResult.data ?? []) as unknown as OperationEvent[];
  const communications = deriveAgentCommunications(events, { agents, tasks, approvals });
  return <OperationsCanvas organizationId={organizationId} previewMode={previewMode} tasks={tasks} agents={agents} approvals={approvals} events={events.map(({ metadata: _metadata, ...event }) => event)} communications={communications} hasDataError={Boolean(tasksResult.error || agentsResult.error || approvalsResult.error || auditResult.error)} />;
}
