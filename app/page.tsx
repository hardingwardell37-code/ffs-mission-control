import { requireContext } from "@/lib/auth";
export default async function HomePage(){
  const { supabase, organizationId } = await requireContext();
  const [agents, tasks, approvals] = await Promise.all([supabase.from("agents").select("id,name,purpose,status,updated_at", { count: "exact" }).eq("organization_id", organizationId).is("archived_at", null).order("updated_at", { ascending: false }).limit(5), supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["queued", "running", "blocked", "awaiting_approval"]), supabase.from("approvals").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending")]);
  return <>
    <div className="eyebrow">Private control plane · Foundation build</div>
    <h1>Govern the system before the system governs itself.</h1>
    <p className="lede">FFS Mission Control is the operating surface for agents, tasks, approvals, tool permissions, memory boundaries and execution history. Phase 1 establishes governance before autonomous execution is introduced.</p>
    <section className="grid">
      <div className="card"><div className="label">Registered agents</div><div className="metric">{agents.count ?? 0}</div></div><div className="card"><div className="label">Active tasks</div><div className="metric">{tasks.count ?? 0}</div></div><div className="card"><div className="label">Pending approvals</div><div className="metric">{approvals.count ?? 0}</div></div><div className="card"><div className="label">Execution</div><div className="metric small">Locked</div></div>
    </section>
    <section className="section">
      <div className="section-head"><div><div className="eyebrow">Registry</div><h2>Agent fleet</h2></div><div className="status"><span className="dot"/>Control plane online</div></div>
      <div className="table">
        <div className="row header"><div>Agent</div><div>Role</div><div>Status</div><div>Last activity</div></div>
        {agents.data?.length ? agents.data.map(a => <div className="row" key={a.id}><strong>{a.name}</strong><div>{a.purpose}</div><div><span className={`badge ${a.status}`}>{a.status}</span></div><time>{new Date(a.updated_at).toLocaleDateString()}</time></div>) : <div className="empty">No agents registered. Create the first governed worker in Agent Registry.</div>}
      </div>
    </section>
  </>;
}
