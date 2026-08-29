import Link from "next/link";
import { requireContext } from "@/lib/auth";

type Relation<T> = T | T[] | null;
type Agent = { id: string; name: string; purpose: string; status: string; updated_at: string };
type Task = {
  id: string;
  agent_id: string | null;
  title: string;
  status: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  output: unknown;
  error_message: string | null;
  agents: Relation<{ name: string }>;
};
type Approval = {
  id: string;
  task_id: string;
  action_key: string;
  reason: string;
  status: string;
  requested_at: string;
  tasks: Relation<{ title: string; agent_id: string | null; agents: Relation<{ name: string }> }>;
};
type AuditEvent = {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

const activeStatuses = ["draft", "queued", "running", "blocked", "awaiting_approval"];

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

const words = (value: string) => value.replaceAll("_", " ").replaceAll(".", " ");
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;

const agentState = (agent: Agent, tasks: Task[]) => {
  const assigned = tasks.find((task) => task.agent_id === agent.id && activeStatuses.includes(task.status));
  if (!assigned) return { label: agent.status === "active" ? "Idle" : "Offline", task: "No active assignment", tone: agent.status === "active" ? "idle" : "offline" };
  const labels: Record<string, string> = {
    draft: "Drafting",
    queued: "Queued",
    running: "Working",
    blocked: "Blocked",
    awaiting_approval: "Waiting approval",
  };
  return { label: labels[assigned.status] ?? words(assigned.status), task: assigned.title, tone: assigned.status };
};

export default async function HomePage() {
  const { supabase, organizationId } = await requireContext();
  const [tasksResult, agentsResult, approvalsResult, auditResult] = await Promise.all([
    supabase.from("tasks").select("id,agent_id,title,status,created_at,started_at,finished_at,output,error_message,agents(name)").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
    supabase.from("agents").select("id,name,purpose,status,updated_at").eq("organization_id", organizationId).is("archived_at", null).order("updated_at", { ascending: false }).limit(20),
    supabase.from("approvals").select("id,task_id,action_key,reason,status,requested_at,tasks(title,agent_id,agents(name))").eq("organization_id", organizationId).order("requested_at", { ascending: false }).limit(12),
    supabase.from("audit_events").select("id,event_type,entity_type,entity_id,created_at,metadata").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(12),
  ]);

  const tasks = (tasksResult.data ?? []) as unknown as Task[];
  const agents = (agentsResult.data ?? []) as Agent[];
  const approvals = (approvalsResult.data ?? []) as unknown as Approval[];
  const events = (auditResult.data ?? []) as AuditEvent[];
  const activeTasks = tasks.filter((task) => activeStatuses.includes(task.status));
  const completions = tasks.filter((task) => task.status === "completed").slice(0, 5);
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const issues = tasks.filter((task) => ["blocked", "failed"].includes(task.status)).length;
  const activeAgents = new Set(activeTasks.map((task) => task.agent_id).filter(Boolean)).size;
  const errors = [tasksResult.error, agentsResult.error, approvalsResult.error, auditResult.error].filter(Boolean);
  const systemState = issues ? "Attention required" : pendingApprovals.length ? "Approval hold" : activeTasks.length ? "Operations active" : "Standing by";
  const stages = [
    { label: "Queued", statuses: ["draft", "queued"] },
    { label: "In progress", statuses: ["running"] },
    { label: "Approval", statuses: ["awaiting_approval"] },
    { label: "Completed", statuses: ["completed"] },
    { label: "Exceptions", statuses: ["blocked", "failed", "cancelled"] },
  ];

  return (
    <main className="command-center">
      <header className="command-header">
        <div className="command-identity">
          <span className="command-kicker">FFS / OPERATIONS</span>
          <h1>Mission Control</h1>
          <div className={`system-state ${issues ? "alert" : ""}`}><span className="state-pulse" />{systemState}</div>
        </div>
        <div className="command-metrics" aria-label="Operational summary">
          <div><strong>{activeTasks.length}</strong><span>Active tasks</span></div>
          <div><strong>{activeAgents}</strong><span>Agents engaged</span></div>
          <div><strong>{pendingApprovals.length}</strong><span>Approval holds</span></div>
          <div><strong>{issues}</strong><span>Exceptions</span></div>
        </div>
      </header>

      {errors.length > 0 && <div className="command-error">Live operational data is partially unavailable. Refresh or inspect Activity for details.</div>}

      <section className="operations-section" aria-labelledby="active-operations-title">
        <div className="command-section-head">
          <div><span className="section-index">01</span><h2 id="active-operations-title">Active operations</h2></div>
          <Link href="/tasks">Open task queue →</Link>
        </div>
        <div className="operations-board">
          {activeTasks.length ? activeTasks.map((task) => {
            const blocked = ["blocked", "failed"].includes(task.status);
            return (
              <article className="operation-row" key={task.id}>
                <span className={`operation-marker ${task.status}`} aria-hidden="true" />
                <div className="operation-primary"><strong>{task.title}</strong><span>{one(task.agents)?.name ?? "Unassigned"}</span></div>
                <div className="operation-state"><span className={`status-chip ${task.status}`}>{words(task.status)}</span>{task.status === "awaiting_approval" && <span className="approval-flag">Decision required</span>}</div>
                <time className="operation-time">{dateTime(task.created_at)}</time>
                <div className="state-track" aria-label={`Task state: ${words(task.status)}`}><span className={`state-position ${task.status}`} /></div>
                {blocked && <div className="operation-issue">{task.error_message || "Task is blocked; no reason was recorded."}</div>}
              </article>
            );
          }) : <div className="command-empty"><strong>No active operations</strong><span>Queued and running work will appear here.</span><Link href="/tasks">Create a governed task →</Link></div>}
        </div>
      </section>

      <section className="pipeline-section" aria-labelledby="pipeline-title">
        <div className="command-section-head"><div><span className="section-index">02</span><h2 id="pipeline-title">Work pipeline</h2></div></div>
        <div className="pipeline-strip">
          {stages.map((stage) => {
            const items = tasks.filter((task) => stage.statuses.includes(task.status));
            return <div className="pipeline-stage" key={stage.label}><div className="pipeline-label"><span>{stage.label}</span><strong>{items.length}</strong></div><div className="pipeline-items">{items.slice(0, 2).map((task) => <span key={task.id}>{task.title}</span>)}{items.length === 0 && <span className="pipeline-clear">Clear</span>}{items.length > 2 && <span className="pipeline-more">+{items.length - 2} more</span>}</div></div>;
          })}
        </div>
      </section>

      <div className="command-grid">
        <section className="command-panel agents-panel" aria-labelledby="agent-ops-title">
          <div className="panel-heading"><div><span className="section-index">03</span><h2 id="agent-ops-title">Agent operations</h2></div><Link href="/agents">Registry →</Link></div>
          <div className="agent-list">{agents.length ? agents.map((agent) => { const state = agentState(agent, tasks); return <div className="agent-operation" key={agent.id}><span className={`agent-signal ${state.tone}`} /><div className="agent-copy"><strong>{agent.name}</strong><span>{agent.purpose}</span></div><div className="agent-assignment"><strong>{state.label}</strong><span>{state.task}</span></div></div>; }) : <div className="panel-empty">No agents registered.</div>}</div>
        </section>

        <section className="command-panel approvals-panel" aria-labelledby="approval-watch-title">
          <div className="panel-heading"><div><span className="section-index">04</span><h2 id="approval-watch-title">Approval watch</h2></div><Link href="/approvals">Review all →</Link></div>
          <div className="approval-watch-list">{pendingApprovals.length ? pendingApprovals.map((approval) => { const task = one(approval.tasks); return <Link className="approval-watch-item" href="/approvals" key={approval.id}><span>{words(approval.action_key)}</span><strong>{task?.title ?? "Governed action"}</strong><small>{one(task?.agents ?? null)?.name ?? "Unassigned"} · {dateTime(approval.requested_at)}</small></Link>; }) : <div className="panel-empty"><strong>No decisions waiting</strong><span>Approval-gated actions will appear here.</span></div>}</div>
        </section>

        <section className="command-panel completions-panel" aria-labelledby="completions-title">
          <div className="panel-heading"><div><span className="section-index">05</span><h2 id="completions-title">Recent completions</h2></div><Link href="/tasks">Task history →</Link></div>
          <div className="completion-list">{completions.length ? completions.map((task) => <div className="completion-item" key={task.id}><span className="completion-mark">✓</span><div><strong>{task.title}</strong><span>{one(task.agents)?.name ?? "Unassigned"}</span></div><time>{dateTime(task.finished_at ?? task.created_at)}</time></div>) : <div className="panel-empty">No completed tasks recorded.</div>}</div>
        </section>

        <section className="command-panel activity-panel" aria-labelledby="activity-title">
          <div className="panel-heading"><div><span className="section-index">06</span><h2 id="activity-title">Live activity</h2></div><Link href="/activity">Audit trail →</Link></div>
          <div className="activity-feed">{events.length ? events.slice(0, 7).map((event) => <div className="activity-node" key={event.id}><span /><div><strong>{words(event.event_type)}</strong><small>{words(event.entity_type)} · {dateTime(event.created_at)}</small></div></div>) : <div className="panel-empty">No audit events recorded.</div>}</div>
        </section>
      </div>
    </main>
  );
}
