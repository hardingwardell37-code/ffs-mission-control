import { OperationsCanvas, type OperationAgent, type OperationApproval, type OperationEvent, type OperationTask } from "@/components/operations-canvas";
import { requireContext } from "@/lib/auth";

export default async function HomePage() {
  const { supabase, organizationId } = await requireContext();
  const [tasksResult, agentsResult, approvalsResult, auditResult] = await Promise.all([
    supabase.from("tasks").select("id,agent_id,title,status,created_at,started_at,finished_at,output,error_message,agents(name)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    supabase.from("agents").select("id,name,purpose,status,updated_at,department,agent_skills(count)").eq("organization_id", organizationId).is("archived_at", null).order("updated_at", { ascending: false }).limit(20),
    supabase.from("approvals").select("id,task_id,action_key,reason,status,requested_at,tasks(title,agent_id,agents(name))").eq("organization_id", organizationId).order("requested_at", { ascending: false }).limit(12),
    supabase.from("audit_events").select("id,event_type,entity_type,entity_id,created_at,metadata").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(16),
  ]);

  return <OperationsCanvas organizationId={organizationId} tasks={(tasksResult.data ?? []) as unknown as OperationTask[]} agents={(agentsResult.data ?? []) as unknown as OperationAgent[]} approvals={(approvalsResult.data ?? []) as unknown as OperationApproval[]} events={(auditResult.data ?? []) as OperationEvent[]} hasDataError={Boolean(tasksResult.error || agentsResult.error || approvalsResult.error || auditResult.error)} />;
}
