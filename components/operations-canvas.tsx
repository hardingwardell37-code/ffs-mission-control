"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/browser";

type Relation<T> = T | T[] | null;
export type OperationTask = { id: string; agent_id: string | null; title: string; status: string; created_at: string; started_at: string | null; finished_at: string | null; output: unknown; error_message: string | null; agents: Relation<{ name: string }> };
export type OperationAgent = { id: string; name: string; purpose: string; status: string; updated_at: string; department: string | null; agent_skills: Array<{ count: number }> | null };
export type OperationApproval = { id: string; task_id: string; action_key: string; reason: string; status: string; requested_at: string; tasks: Relation<{ title: string; agent_id: string | null; agents: Relation<{ name: string }> }> };
export type OperationEvent = { id: string; event_type: string; entity_type: string; entity_id: string | null; created_at: string; metadata: Record<string, unknown> | null };
type Selection = { kind: "task" | "agent"; id: string } | null;

const activeStatuses = ["draft", "queued", "running", "blocked", "awaiting_approval"];
const stages = [
  { id: "queued", label: "Queued", statuses: ["draft", "queued"] },
  { id: "working", label: "Working", statuses: ["running"] },
  { id: "review", label: "Review", statuses: [] },
  { id: "approval", label: "Approval", statuses: ["awaiting_approval"] },
  { id: "completed", label: "Completed", statuses: ["completed"] },
  { id: "exception", label: "Blocked / Failed", statuses: ["blocked", "failed", "cancelled"] },
] as const;

const words = (value: string) => value.replaceAll("_", " ").replaceAll(".", " ");
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;
const dateTime = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const stageFor = (status: string) => stages.find((stage) => stage.statuses.some((item) => item === status))?.id ?? "queued";
const isIssue = (status: string) => status === "blocked" || status === "failed";
const eventLanguage: Record<string, string> = { "task.created": "Task entered the queue", "task.started": "Task started", "task.status_changed": "Task moved to a new stage", "task.completed": "Task completed", "task.failed": "Task failed", "approval.requested": "Approval requested", "approval.approved": "Approval approved", "approval.rejected": "Approval rejected", "agent.updated": "Agent updated" };
const readableEvent = (event: OperationEvent) => eventLanguage[event.event_type] ?? words(event.event_type);
function outputText(output: unknown) { if (output == null) return null; if (typeof output === "string") return output; try { return JSON.stringify(output, null, 2); } catch { return "Recorded output could not be displayed."; } }

export function OperationsCanvas({ organizationId, tasks, agents, approvals, events, hasDataError }: { organizationId: string; tasks: OperationTask[]; agents: OperationAgent[]; approvals: OperationApproval[]; events: OperationEvent[]; hasDataError: boolean }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "polling">("connecting");
  const previousStages = useRef<Record<string, string>>(Object.fromEntries(tasks.map((task) => [task.id, stageFor(task.status)])));
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => router.refresh(), 220); };
    const polling = setInterval(refresh, 30_000);
    try {
      const supabase = createClient();
      const filter = `organization_id=eq.${organizationId}`;
      const channel = supabase.channel(`command-center:${organizationId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "agents", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter }, refresh)
        .on("postgres_changes", { event: "*", schema: "public", table: "audit_events", filter }, refresh)
        .subscribe((status) => setConnection(status === "SUBSCRIBED" ? "live" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "polling" : "connecting"));
      return () => { clearInterval(polling); clearTimeout(timer); void supabase.removeChannel(channel); };
    } catch { setConnection("polling"); return () => { clearInterval(polling); clearTimeout(timer); }; }
  }, [organizationId, router]);

  useEffect(() => { previousStages.current = Object.fromEntries(tasks.map((task) => [task.id, stageFor(task.status)])); }, [tasks]);
  useEffect(() => {
    if (!selection) return;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelection(null); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [selection]);

  const pending = approvals.filter((approval) => approval.status === "pending");
  const active = tasks.filter((task) => activeStatuses.includes(task.status));
  const completions = tasks.filter((task) => task.status === "completed").slice(0, 5);
  const exceptions = tasks.filter((task) => isIssue(task.status)).slice(0, 5);
  const activeAgentIds = new Set(active.map((task) => task.agent_id).filter(Boolean));
  const selectedTask = selection?.kind === "task" ? tasks.find((task) => task.id === selection.id) : null;
  const selectedAgent = selection?.kind === "agent" ? agents.find((agent) => agent.id === selection.id) : null;
  const selectedAgentTask = selectedAgent ? active.find((task) => task.agent_id === selectedAgent.id) : null;
  const selectedEvents = useMemo(() => selection ? events.filter((event) => event.entity_id === selection.id).slice(0, 4) : [], [events, selection]);
  const systemState = exceptions.length ? "Attention required" : pending.length ? "Approval hold" : active.length ? "Operations active" : "Standing by";

  const taskCard = (task: OperationTask) => {
    const current = stageFor(task.status);
    const previous = previousStages.current[task.id];
    const from = stages.findIndex((stage) => stage.id === previous);
    const to = stages.findIndex((stage) => stage.id === current);
    const style = { "--task-shift": `${Math.max(-3, Math.min(3, to - from)) * -118}px` } as CSSProperties;
    const approval = pending.find((item) => item.task_id === task.id);
    return <article className={`flow-task ${task.status} ${previous && previous !== current ? "task-moved" : ""}`} style={style} key={task.id}>
      <button className="flow-task-open" type="button" onClick={() => setSelection({ kind: "task", id: task.id })} aria-label={`Open details for ${task.title}`}>
        <span className="flow-task-top"><span className={`status-chip ${task.status}`}>{words(task.status)}</span><time>{dateTime(task.started_at ?? task.created_at)}</time></span>
        <strong>{task.title}</strong>
        <span className="task-route"><span className="route-agent">{one(task.agents)?.name ?? "Unassigned"}</span><span className={`route-trace ${isIssue(task.status) ? "halted" : ""}`} aria-hidden="true"><i /></span><span>{stages.find((stage) => stage.id === current)?.label}</span></span>
        {isIssue(task.status) && <span className="task-warning">{task.error_message ?? "No exception reason recorded"}</span>}
      </button>
      {approval && <Link className="task-approval-interrupt" href="/approvals">Decision required →</Link>}
    </article>;
  };

  return <main className="command-center">
    <header className="command-header">
      <div className="command-identity"><span className="command-kicker">FFS / LIVE OPERATIONS</span><h1>Mission Control</h1><div className={`system-state ${exceptions.length ? "alert" : ""}`}><span className="state-pulse" />{systemState}</div></div>
      <div className="command-metrics" aria-label="Operational summary"><div><strong>{active.length}</strong><span>Active tasks</span></div><div><strong>{activeAgentIds.size}</strong><span>Agents engaged</span></div><div><strong>{pending.length}</strong><span>Approval holds</span></div><div><strong>{exceptions.length}</strong><span>Exceptions</span></div></div>
      <div className={`live-connection ${connection}`}><span />{connection === "live" ? "Realtime connected" : connection === "polling" ? "30s polling fallback" : "Connecting"}</div>
    </header>
    {hasDataError && <div className="command-error">Live operational data is partially unavailable. Refresh or inspect Activity for details.</div>}

    <div className="operations-layout">
      <section className="operations-section live-canvas" aria-labelledby="live-operations-title">
        <div className="command-section-head"><div><span className="section-index">01</span><h2 id="live-operations-title">Live operations canvas</h2></div><Link href="/tasks">Open task queue →</Link></div>
        <div className="agent-uplink" aria-label="Agent activity">{agents.slice(0, 10).map((agent) => { const task = active.find((item) => item.agent_id === agent.id); const tone = task ? task.status : agent.status === "active" ? "idle" : "offline"; return <button type="button" className={`agent-node ${tone}`} onClick={() => setSelection({ kind: "agent", id: agent.id })} key={agent.id}><span className="agent-ring"><i /></span><strong>{agent.name}</strong><small>{task ? words(task.status) : agent.status === "active" ? "Idle" : "Offline"}</small></button>; })}{!agents.length && <span className="canvas-empty-note">No agents registered.</span>}</div>
        <div className="workflow-canvas">{stages.map((stage, index) => { const stageTasks = tasks.filter((task) => stage.statuses.some((status) => status === task.status)); const live = stageTasks.some((task) => activeStatuses.includes(task.status)); return <div className={`workflow-stage stage-${stage.id}`} key={stage.id}><header><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage.label}</strong><em>{stageTasks.length}</em></header>{index < stages.length - 1 && <span className={`stage-connector ${live ? "is-live" : ""}`} aria-hidden="true"><i /></span>}<div className="stage-tasks">{stageTasks.slice(0, 5).map(taskCard)}{!stageTasks.length && <div className="stage-empty">{stage.id === "review" ? "No persistent review state" : "Clear"}</div>}{stageTasks.length > 5 && <Link href="/tasks" className="stage-more">+{stageTasks.length - 5} more</Link>}</div></div>; })}</div>
      </section>

      <aside className="operations-rail">
        <section className="command-panel approvals-panel" aria-labelledby="approval-watch-title"><div className="panel-heading"><div><span className="section-index">02</span><h2 id="approval-watch-title">Approval interrupts</h2></div><Link href="/approvals">Review all →</Link></div><div className="approval-watch-list">{pending.length ? pending.map((approval) => { const task = one(approval.tasks); return <Link className="approval-watch-item" href="/approvals" key={approval.id}><span>{words(approval.action_key)}</span><strong>{task?.title ?? "Governed action"}</strong><small>{one(task?.agents ?? null)?.name ?? "Unassigned"} · {dateTime(approval.requested_at)}</small><i aria-hidden="true" /></Link>; }) : <div className="panel-empty"><strong>No decisions waiting</strong><span>Approval-gated actions will appear here.</span></div>}</div></section>
        <section className="command-panel activity-panel" aria-labelledby="activity-title"><div className="panel-heading"><div><span className="section-index">03</span><h2 id="activity-title">Live activity</h2></div><Link href="/activity">Audit trail →</Link></div><div className="activity-feed">{events.length ? events.slice(0, 9).map((event, index) => <div className="activity-node event-arrive" style={{ "--event-delay": `${index * 45}ms` } as CSSProperties} key={event.id}><span /><div><strong>{readableEvent(event)}</strong><small>{words(event.entity_type)} · {dateTime(event.created_at)}</small></div></div>) : <div className="panel-empty">No audit events recorded.</div>}</div></section>
      </aside>
    </div>

    <div className="operations-bottom">
      <section className="command-panel completions-panel" aria-labelledby="completions-title"><div className="panel-heading"><div><span className="section-index">04</span><h2 id="completions-title">Recent completions</h2></div><Link href="/tasks">Task history →</Link></div><div className="completion-list">{completions.length ? completions.map((task) => <button type="button" className="completion-item result-arrive" onClick={() => setSelection({ kind: "task", id: task.id })} key={task.id}><span className="completion-mark">✓</span><div><strong>{task.title}</strong><span>{one(task.agents)?.name ?? "Unassigned"}{outputText(task.output) ? " · Output recorded" : ""}</span></div><time>{dateTime(task.finished_at ?? task.created_at)}</time></button>) : <div className="panel-empty">No completed tasks recorded.</div>}</div></section>
      <section className="command-panel exceptions-panel" aria-labelledby="exceptions-title"><div className="panel-heading"><div><span className="section-index">05</span><h2 id="exceptions-title">Blocked / failed</h2></div><Link href="/tasks">Inspect queue →</Link></div><div className="exception-list">{exceptions.length ? exceptions.map((task) => <button type="button" className="exception-item" onClick={() => setSelection({ kind: "task", id: task.id })} key={task.id}><span className="halt-mark" /><div><strong>{task.title}</strong><span>{task.error_message ?? "No exception reason recorded"}</span></div><span>{words(task.status)}</span></button>) : <div className="panel-empty"><strong>No active exceptions</strong><span>Blocked and failed work will remain visible here.</span></div>}</div></section>
      <section className="command-panel queue-panel" aria-labelledby="queue-title"><div className="panel-heading"><div><span className="section-index">06</span><h2 id="queue-title">Queue summary</h2></div></div><div className="queue-stats"><div><strong>{tasks.filter((task) => ["draft", "queued"].includes(task.status)).length}</strong><span>Waiting</span></div><div><strong>{tasks.filter((task) => task.status === "running").length}</strong><span>Working</span></div><div><strong>{agents.filter((agent) => agent.status === "active" && !activeAgentIds.has(agent.id)).length}</strong><span>Agents idle</span></div></div></section>
    </div>

    {selection && <div className="detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelection(null); }}><aside className="operation-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button ref={closeRef} type="button" className="drawer-close" onClick={() => setSelection(null)} aria-label="Close details">×</button>{selectedTask && <><span className="drawer-kicker">TASK / {words(selectedTask.status)}</span><h2 id="detail-title">{selectedTask.title}</h2><dl><div><dt>Assigned agent</dt><dd>{one(selectedTask.agents)?.name ?? "Unassigned"}</dd></div><div><dt>Created</dt><dd>{dateTime(selectedTask.created_at)}</dd></div><div><dt>Started</dt><dd>{selectedTask.started_at ? dateTime(selectedTask.started_at) : "Not started"}</dd></div><div><dt>Finished</dt><dd>{selectedTask.finished_at ? dateTime(selectedTask.finished_at) : "Not finished"}</dd></div><div><dt>Approval</dt><dd>{pending.some((approval) => approval.task_id === selectedTask.id) ? "Decision pending" : "No pending decision"}</dd></div></dl>{selectedTask.error_message && <div className="drawer-warning"><strong>Exception</strong><span>{selectedTask.error_message}</span></div>}{outputText(selectedTask.output) && <div className="drawer-output"><strong>Recorded output</strong><pre>{outputText(selectedTask.output)}</pre></div>}</>}{selectedAgent && <><span className="drawer-kicker">AGENT / {words(selectedAgent.status)}</span><h2 id="detail-title">{selectedAgent.name}</h2><p>{selectedAgent.purpose}</p><dl><div><dt>Department</dt><dd>{selectedAgent.department ?? "Not assigned"}</dd></div><div><dt>Current task</dt><dd>{selectedAgentTask?.title ?? "No active assignment"}</dd></div><div><dt>Assigned skills</dt><dd>{selectedAgent.agent_skills?.[0]?.count ?? 0}</dd></div><div><dt>Updated</dt><dd>{dateTime(selectedAgent.updated_at)}</dd></div></dl></>}{selectedEvents.length > 0 && <div className="drawer-events"><strong>Recent activity</strong>{selectedEvents.map((event) => <span key={event.id}>{readableEvent(event)} · {dateTime(event.created_at)}</span>)}</div>}</aside></div>}
  </main>;
}
