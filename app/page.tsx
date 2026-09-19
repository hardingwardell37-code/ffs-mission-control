import Link from "next/link";
import { requireContext } from "@/lib/auth";
export default async function HomePage(){
  const { supabase, organizationId } = await requireContext();
  const [campaigns, agents, tasks, approvals] = await Promise.all([
    supabase.from("campaigns").select("id,name,status,entry_mode,updated_at", { count: "exact" }).eq("organization_id", organizationId).neq("status", "archived").order("updated_at", { ascending: false }).limit(5),
    supabase.from("agents").select("id,name,purpose,status,updated_at", { count: "exact" }).eq("organization_id", organizationId).is("archived_at", null).order("updated_at", { ascending: false }).limit(5),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("status", ["queued", "running", "blocked", "awaiting_approval"]),
    supabase.from("approvals").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).eq("status", "pending"),
  ]);
  return <>
    <div className="eyebrow">Personal production studio · Phase 1</div>
    <h1>Campaign core — research, DNA, assets, provenance.</h1>
    <p className="lede">F&amp;P Studio is campaign-first. Phase 1 lands workspaces, Campaign DNA, research with Originality Guard fields, and an asset library with required provenance — before any generation providers.</p>
    <section className="grid">
      <div className="card"><div className="label">Campaigns</div><div className="metric">{campaigns.count ?? 0}</div></div>
      <div className="card"><div className="label">Registered agents</div><div className="metric">{agents.count ?? 0}</div></div>
      <div className="card"><div className="label">Active tasks</div><div className="metric">{tasks.count ?? 0}</div></div>
      <div className="card"><div className="label">Pending approvals</div><div className="metric">{approvals.count ?? 0}</div></div>
    </section>
    <section className="section">
      <div className="section-head"><div><div className="eyebrow">Workspace</div><h2>Recent campaigns</h2></div><Link className="button secondary" href="/campaigns">Open campaigns</Link></div>
      <div className="table">
        <div className="row header"><div>Campaign</div><div>Entry</div><div>Status</div><div>Updated</div></div>
        {campaigns.data?.length ? campaigns.data.map(c => <div className="row" key={c.id}><Link href={`/campaigns/${c.id}`}><strong>{c.name}</strong></Link><div>{c.entry_mode}</div><div><span className={`badge ${c.status}`}>{c.status}</span></div><time>{new Date(c.updated_at).toLocaleDateString()}</time></div>) : <div className="empty">No campaigns yet. Create one under Campaigns to start Brief → Research → DNA → Assets.</div>}
      </div>
    </section>
    <section className="section">
      <div className="section-head"><div><div className="eyebrow">Registry</div><h2>Agent fleet</h2></div><div className="status"><span className="dot"/>Studio online</div></div>
      <div className="table">
        <div className="row header"><div>Agent</div><div>Role</div><div>Status</div><div>Last activity</div></div>
        {agents.data?.length ? agents.data.map(a => <div className="row" key={a.id}><strong>{a.name}</strong><div>{a.purpose}</div><div><span className={`badge ${a.status}`}>{a.status}</span></div><time>{new Date(a.updated_at).toLocaleDateString()}</time></div>) : <div className="empty">No agents registered. Create the first governed worker in Agent Registry.</div>}
      </div>
    </section>
  </>;
}
