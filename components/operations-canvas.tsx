"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { LeadAgentPanel } from "@/components/lead-agent-panel";
import { createClient } from "@/lib/supabase/browser";

type Relation<T> = T | T[] | null;
export type OperationTask = { id: string; agent_id: string | null; title: string; status: string; created_at: string; started_at: string | null; finished_at: string | null; output?: unknown; error_message?: string | null; agents: Relation<{ name: string }> };
export type OperationAgent = { id: string; name: string; purpose?: string | null; status: string; updated_at?: string; department: string | null; agent_skills?: Array<{ count: number }> | null };
export type OperationApproval = { id: string; task_id: string; action_key: string; reason?: string; status: string; requested_at: string; tasks: Relation<{ title: string; agent_id: string | null; agents: Relation<{ name: string }> }> };
export type OperationEvent = { id: string; event_type: string; entity_type: string; entity_id?: string | null; created_at: string; metadata?: Record<string, unknown> | null };
type Selection = { kind: "task" | "agent"; id: string } | null;

const demoSequence = [
  { label: "Queued", status: "queued", agentId: "demo-intel", event: "Campaign entered operations", communication: "Mission Control → Market Intelligence\nResearch brief queued", route: -1 },
  { label: "Research", status: "running", agentId: "demo-intel", event: "Market Intelligence activated", communication: "Market Intelligence\nAudience signals being analyzed", route: -1 },
  { label: "Handoff", status: "handoff", agentId: "demo-strategy", event: "Research handoff completed", communication: "Market Intelligence → Content Strategist\nResearch packet delivered", route: 0 },
  { label: "Strategy", status: "running", agentId: "demo-strategy", event: "Campaign strategy drafted", communication: "Content Strategist\nCampaign direction assembled", route: -1 },
  { label: "Handoff", status: "handoff", agentId: "demo-copy", event: "Creative brief transferred", communication: "Content Strategist → Copy Chief\nCreative brief ready", route: 1 },
  { label: "Creative", status: "running", agentId: "demo-copy", event: "Copy Chief activated", communication: "Copy Chief\nCampaign concept in production", route: -1 },
  { label: "Review", status: "review", agentId: "demo-review", event: "Creative submitted for review", communication: "Copy Chief → Marketing Reviewer\nDraft submitted", route: 2 },
  { label: "Approval", status: "awaiting_approval", agentId: "demo-review", event: "Approval required — route paused", communication: "Marketing Reviewer\nRelease approval required", route: 3 },
  { label: "Completed", status: "completed", agentId: "demo-review", event: "Demo Campaign completed", communication: "Marketing Reviewer → Mission Control\nCampaign approved", route: 4 },
  { label: "Output", status: "completed", agentId: "demo-review", event: "Campaign output created", communication: "Mission Control\nCampaign package recorded", route: 4 },
] as const;
const demoAgents: OperationAgent[] = [
  { id: "demo-intel", name: "Market Intelligence", status: "active", department: "Research" },
  { id: "demo-strategy", name: "Content Strategist", status: "active", department: "Strategy" },
  { id: "demo-copy", name: "Copy Chief", status: "active", department: "Creative" },
  { id: "demo-review", name: "Marketing Reviewer", status: "active", department: "Governance" },
];
const demoTime = "2026-08-30T12:00:00.000Z";
const activeStatuses = ["draft", "queued", "running", "handoff", "review", "blocked", "awaiting_approval"];
const pipeline = ["Research", "Strategy", "Creative", "Review", "Approval", "Completed"];
const words = (value: string) => value.replaceAll("_", " ").replaceAll(".", " ");
const one = <T,>(value: Relation<T>) => Array.isArray(value) ? value[0] ?? null : value;
const dateTime = (value: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
const outputText = (output: unknown) => { if (output == null) return null; if (typeof output === "string") return output; try { return JSON.stringify(output, null, 2); } catch { return "Recorded output could not be displayed."; } };
const eventLabels: Record<string, string> = { "task.created": "Task entered operations", "task.queued": "Task queued", "task.started": "Task started", "task.status_changed": "Task state changed", "task.blocked": "Task blocked", "task.handoff": "Agent handoff", "task.completed": "Task completed", "task.failed": "Task failed", "task.cancelled": "Task cancelled", "approval.requested": "Approval required", "approval.approved": "Approval approved", "approval.rejected": "Approval rejected", "agent.updated": "Agent state changed" };

export function OperationsCanvas({ organizationId, previewMode, tasks, agents, approvals, events, hasDataError }: { organizationId: string; previewMode: boolean; tasks: OperationTask[]; agents: OperationAgent[]; approvals: OperationApproval[]; events: OperationEvent[]; hasDataError: boolean }) {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>(null);
  const [connection, setConnection] = useState<"connecting" | "live" | "polling">("connecting");
  const [demoStep, setDemoStep] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const demoActive = previewMode && tasks.length === 0;
  const demo = demoSequence[demoStep];

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => router.refresh(), 220); };
    const polling = setInterval(refresh, 30_000);
    if (previewMode) { setConnection("polling"); return () => { clearInterval(polling); clearTimeout(timer); }; }
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
  }, [organizationId, previewMode, router]);

  useEffect(() => {
    if (!demoActive || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setDemoStep((step) => (step + 1) % demoSequence.length), 2200);
    return () => window.clearInterval(timer);
  }, [demoActive]);

  useEffect(() => {
    if (!selection) return;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelection(null); };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [selection]);

  const demoTask: OperationTask = { id: "demo-campaign", agent_id: demo.agentId, title: "Demo Campaign", status: demo.status, created_at: demoTime, started_at: demoStep > 0 ? demoTime : null, finished_at: demoStep >= 8 ? demoTime : null, output: demoStep === 9 ? "Campaign package" : null, agents: { name: demoAgents.find((agent) => agent.id === demo.agentId)?.name ?? "Mission Control" } };
  const displayTasks = demoActive ? [demoTask] : tasks;
  const displayAgents = demoActive ? demoAgents : agents;
  const displayApprovals: OperationApproval[] = demoActive && demoStep === 7 ? [{ id: "demo-approval", task_id: demoTask.id, action_key: "campaign_release", status: "pending", requested_at: demoTime, tasks: { title: demoTask.title, agent_id: demoTask.agent_id, agents: demoTask.agents } }] : approvals;
  const feed = demoActive ? demoSequence.slice(0, demoStep + 1).reverse().map((step, index) => ({ id: `demo-${demoStep}-${index}`, label: step.event, detail: step.label, time: "SIM" })) : events.slice(0, 8).map((event) => ({ id: event.id, label: eventLabels[event.event_type] ?? words(event.event_type), detail: words(event.entity_type), time: dateTime(event.created_at) }));
  const communications = demoActive ? demoSequence.slice(Math.max(0, demoStep - 2), demoStep + 1).reverse().map((step, index) => ({ id: `${demoStep}-${index}`, lines: step.communication.split("\n") })) : events.slice(0, 5).map((event) => ({ id: event.id, lines: [eventLabels[event.event_type] ?? words(event.event_type), words(event.entity_type)] }));
  const pending = displayApprovals.filter((approval) => approval.status === "pending");
  const active = displayTasks.filter((task) => activeStatuses.includes(task.status));
  const completed = displayTasks.filter((task) => task.status === "completed").slice(0, 4);
  const selectedTask = selection?.kind === "task" ? displayTasks.find((task) => task.id === selection.id) : null;
  const selectedAgent = selection?.kind === "agent" ? displayAgents.find((agent) => agent.id === selection.id) : null;
  const selectedAgentTask = selectedAgent ? active.find((task) => task.agent_id === selectedAgent.id) : null;
  const selectedEvents = useMemo(() => selection ? feed.slice(0, 4) : [], [feed, selection]);
  const agentActive = (agent: OperationAgent) => demoActive ? agent.id === demo.agentId : active.some((task) => task.agent_id === agent.id);
  const progress = demoActive ? Math.min(100, (demoStep / 8) * 100) : 0;

  return <main className={`agent-os ${demoActive ? `simulation step-${demoStep}` : ""}`}>
    <header className="os-header">
      <div><span className="os-eyebrow">FFS / AGENT OPERATING SYSTEM</span><h1>Mission Control</h1></div>
      <div className="os-status"><span className={`os-beacon ${pending.length ? "hold" : ""}`} />{pending.length ? "Approval hold" : active.length ? "Operations active" : "Systems ready"}</div>
      <div className={`os-connection ${connection}`}><i />{connection === "live" ? "Live uplink" : connection === "polling" ? "Preview relay" : "Connecting"}</div>
    </header>
    {demoActive && <div className="simulation-label"><strong>Preview Operations Simulation</strong><span>Client-only scenario · 22 second cycle</span><em>{demo.label}</em></div>}
    {hasDataError && <div className="command-error">Operational data is partially unavailable.</div>}
    <LeadAgentPanel previewMode={previewMode} />

    <div className="os-grid">
      <nav className="os-nav" aria-label="Mission Control systems"><span className="rail-mark">FFS</span>{["Command", "Agents", "Work", "Approvals", "Memory", "Systems"].map((item, index) => <Link className={index === 0 ? "active" : ""} href={index === 0 ? "/" : index === 1 ? "/agents" : index === 2 ? "/tasks" : index === 3 ? "/approvals" : "/activity"} key={item}><b>{String(index + 1).padStart(2, "0")}</b><span>{item}</span></Link>)}</nav>

      <section className="ops-map" aria-labelledby="operations-map-title">
        <div className="surface-head"><div><span>01 / PRIMARY SURFACE</span><h2 id="operations-map-title">Live Operations Map</h2></div><p>{active.length} active work item{active.length === 1 ? "" : "s"}</p></div>
        <div className="map-field">
          <div className="map-grid" aria-hidden="true" />
          {[0, 1, 2, 3, 4].map((route) => <div className={`route-line route-${route} ${demoActive && demo.route === route ? "live" : ""}`} key={route}><i /></div>)}
          {displayAgents.slice(0, 4).map((agent, index) => <button className={`map-agent agent-${index} ${agentActive(agent) ? "active" : "idle"} ${demoActive && demo.route === index ? "receiving" : ""}`} type="button" onClick={() => setSelection({ kind: "agent", id: agent.id })} key={agent.id}><span className="node-orbit"><i /></span><small>{agent.department ?? "Operations"}</small><strong>{agent.name}</strong><em>{agentActive(agent) ? words(demoActive ? demo.status : selectedAgentTask?.status ?? "working") : "Ready"}</em></button>)}
          {displayAgents.length < 4 && !demoActive && <div className="map-empty">Register agents to populate the operations network.</div>}
          {displayTasks[0] && <button className={`map-task ${displayTasks[0].status}`} style={{ "--task-progress": `${progress}%` } as CSSProperties} type="button" onClick={() => setSelection({ kind: "task", id: displayTasks[0].id })}><span>ACTIVE WORK</span><strong>{displayTasks[0].title}</strong><em>{words(displayTasks[0].status)}</em></button>}
          {pending.length > 0 && <div className="approval-gate"><span>Decision gate</span><strong>Approval required</strong><i /></div>}
          {demoActive && demoStep >= 8 && <div className={`output-packet ${demoStep === 9 ? "visible" : ""}`}><span>OUTPUT / CAMPAIGN</span><strong>Campaign package</strong><em>Ready for delivery</em></div>}
          <div className="map-legend"><span><i className="active" />Active</span><span><i />Ready</span><span><i className="hold" />Approval</span></div>
        </div>
      </section>

      <aside className="os-right-rail">
        <section className="os-panel live-activity"><div className="panel-title"><span>02</span><h2>Live Activity</h2><Link href="/activity">View log</Link></div><div className="os-feed" aria-live="polite">{feed.map((item, index) => <div className="os-event" style={{ "--event-order": index } as CSSProperties} key={item.id}><i /><div><strong>{item.label}</strong><span>{item.detail}</span></div><time>{item.time}</time></div>)}</div></section>
        <section className="os-panel communications"><div className="panel-title"><span>03</span><h2>Agent Communications</h2></div><div className="comms-list">{communications.map((item, index) => <div className="comm-item" key={item.id}><span>{String(communications.length - index).padStart(2, "0")}</span><div><strong>{item.lines[0]}</strong><p>{item.lines[1]}</p></div></div>)}</div></section>
      </aside>
    </div>

    <section className="workflow-dock" aria-label="Active workflow"><div className="dock-title"><span>04 / ACTIVE WORKFLOW</span><strong>{displayTasks[0]?.title ?? "No work in motion"}</strong></div><div className="pipeline">{pipeline.map((stage, index) => { const current = demoActive ? Math.min(5, demoStep === 0 ? 0 : demoStep <= 2 ? 0 : demoStep <= 4 ? 1 : demoStep === 5 ? 2 : demoStep === 6 ? 3 : demoStep === 7 ? 4 : 5) : -1; return <div className={`${index === current ? "current" : index < current ? "passed" : ""} ${pending.length && index > 4 ? "halted" : ""}`} key={stage}><span>{String(index + 1).padStart(2, "0")}</span><strong>{stage}</strong>{index < pipeline.length - 1 && <i />}</div>; })}</div></section>

    <div className="os-bottom">
      <section className="os-panel outputs"><div className="panel-title"><span>05</span><h2>Recent Outputs</h2><Link href="/tasks">All outputs</Link></div><div className="output-list">{(demoActive && demoStep === 9 ? [demoTask] : completed).map((task) => <button type="button" onClick={() => setSelection({ kind: "task", id: task.id })} key={task.id}><i>↗</i><span><strong>{task.title}</strong><small>{outputText(task.output) ? "Campaign · Output recorded" : "Completed work item"}</small></span><time>{dateTime(task.finished_at ?? task.created_at)}</time></button>)}{!(demoActive && demoStep === 9) && !completed.length && <p className="panel-empty">Outputs will appear when work completes.</p>}</div></section>
      <section className="os-panel system-strip"><div className="panel-title"><span>06</span><h2>Memory / Systems</h2></div><div className="system-cells">{[["Knowledge", events.length], ["Skills", displayAgents.reduce((sum, agent) => sum + (agent.agent_skills?.[0]?.count ?? 0), 0)], ["Tools", "Ready"], ["Agents", displayAgents.length], ["System", hasDataError ? "Degraded" : "Nominal"], ["Approvals", pending.length]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong><i className={label === "System" && hasDataError ? "warn" : ""} /></div>)}</div></section>
    </div>

    {selection && <div className="detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelection(null); }}><aside className="operation-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button ref={closeRef} type="button" className="drawer-close" onClick={() => setSelection(null)} aria-label="Close details">×</button>{selectedTask && <><span className="drawer-kicker">TASK / {words(selectedTask.status)}</span><h2 id="detail-title">{selectedTask.title}</h2><dl><div><dt>Assigned agent</dt><dd>{one(selectedTask.agents)?.name ?? "Unassigned"}</dd></div><div><dt>Current stage</dt><dd>{demoActive ? demo.label : words(selectedTask.status)}</dd></div><div><dt>Approval</dt><dd>{pending.some((approval) => approval.task_id === selectedTask.id) ? "Decision pending" : "No pending decision"}</dd></div></dl>{outputText(selectedTask.output) && <div className="drawer-output"><strong>Recorded output</strong><pre>{outputText(selectedTask.output)}</pre></div>}</>}{selectedAgent && <><span className="drawer-kicker">AGENT / {agentActive(selectedAgent) ? "ACTIVE" : "READY"}</span><h2 id="detail-title">{selectedAgent.name}</h2><dl><div><dt>Department</dt><dd>{selectedAgent.department ?? "Operations"}</dd></div><div><dt>Current state</dt><dd>{agentActive(selectedAgent) ? words(demoActive ? demo.status : "working") : "Ready"}</dd></div><div><dt>Associated task</dt><dd>{selectedAgentTask?.title ?? (demoActive && demo.agentId === selectedAgent.id ? demoTask.title : "No active assignment")}</dd></div></dl></>}{selectedEvents.length > 0 && <div className="drawer-events"><strong>Recent operational events</strong>{selectedEvents.map((event) => <span key={event.id}>{event.label} · {event.time}</span>)}</div>}</aside></div>}
  </main>;
}
