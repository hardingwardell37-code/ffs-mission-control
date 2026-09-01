import Link from "next/link";
import { archiveAgent } from "@/lib/actions";
import { requireContext } from "@/lib/auth";

type AgentRow={id:string;name:string;slug:string;purpose:string;status:string;model_provider:string;model_name:string;department:string|null;agent_skills:Array<{count:number}>};

export default async function AgentsPage() {
  const { supabase, organizationId } = await requireContext();
  const { data, error } = await supabase.from("agents").select("id,name,slug,purpose,status,model_provider,model_name,department,agent_skills(count)").eq("organization_id", organizationId).is("archived_at", null).order("department").order("name");
  const agents=(data ?? []) as unknown as AgentRow[];
  const departments=agents.reduce<Record<string,AgentRow[]>>((groups,agent)=>{const key=agent.department || "Independent";(groups[key]??=[]).push(agent);return groups;},{});
  return <>
    <div className="section-head"><div><div className="eyebrow">Governed workers</div><h1>Agent Registry</h1></div><Link className="button" href="/agents/new">Register agent</Link></div>
    <p className="lede">Identity, department, runtime bounds, skills, models, and tool grants are explicit. Missing permission means denied.</p>
    {error ? <div className="error">Unable to load agents: {error.message}</div> : agents.length ? <div className="department-stack section">{Object.entries(departments).map(([department,rows])=><section className="department-group" key={department}>
      <div className="department-heading"><div><span className="eyebrow">Department</span><h2>{department}</h2></div><strong>{rows.length} agents</strong></div>
      <div className="table"><div className="row agent-row header"><div>Agent</div><div>Purpose</div><div>Skills / Model</div><div>Status / Action</div></div>{rows.map(agent=><div className="row agent-row" key={agent.id}>
        <div><Link href={`/agents/${agent.id}`}><strong>{agent.name}</strong></Link><div className="muted">{agent.slug}</div></div><div>{agent.purpose}</div><div><strong>{agent.agent_skills?.[0]?.count ?? 0} skills</strong><div className="muted">{agent.model_provider} / {agent.model_name}</div></div><div className="inline"><span className={`badge ${agent.status}`}>{agent.status}</span><form action={archiveAgent}><input type="hidden" name="id" value={agent.id}/><button className="text-button">Archive</button></form></div>
      </div>)}</div>
    </section>)}</div> : <div className="empty">No agents yet. Register one to establish its execution contract.</div>}
  </>;
}
