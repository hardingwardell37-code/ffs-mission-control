import Link from "next/link";
import { notFound } from "next/navigation";
import { AgentForm } from "@/components/agent-form";
import { assignAgentSkill, removeAgentSkill, saveToolPermission, updateAgent } from "@/lib/actions";
import { requireContext } from "@/lib/auth";

type Skill={id:string;name:string;category:string|null;source_name:string;status:string};
type Assignment={skill_id:string;skills:Skill|Skill[]|null};
const one=<T,>(value:T|T[]|null)=>Array.isArray(value)?value[0]??null:value;

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, organizationId } = await requireContext();
  const [{ data:agent },{data:permissions},{data:assignments},{data:skills}] = await Promise.all([
    supabase.from("agents").select("*").eq("id", id).eq("organization_id", organizationId).is("archived_at", null).maybeSingle(),
    supabase.from("agent_tool_permissions").select("tool_key,can_read,can_write,requires_approval").eq("agent_id",id).order("tool_key"),
    supabase.from("agent_skills").select("skill_id,skills(id,name,category,source_name,status)").eq("agent_id",id).eq("organization_id",organizationId).order("assigned_at"),
    supabase.from("skills").select("id,name,category,source_name,status").eq("organization_id",organizationId).eq("status","active").is("archived_at",null).order("name")
  ]);
  if(!agent) notFound();
  const assigned=(assignments ?? []) as unknown as Assignment[]; const assignedIds=new Set(assigned.map(item=>item.skill_id)); const available=((skills ?? []) as Skill[]).filter(skill=>!assignedIds.has(skill.id));
  return <>
    <div className="eyebrow">Registry / {agent.department ?? "Independent"} / {agent.slug}</div><h1>{agent.name}</h1><p className="lede">{agent.purpose}</p>
    <section className="agent-contract-strip"><div><span>Department</span><strong>{agent.department ?? "Independent"}</strong></div><div><span>Status</span><strong>{agent.status}</strong></div><div><span>Assigned skills</span><strong>{assigned.length}</strong></div><div><span>External authority</span><strong>Approval-gated</strong></div></section>
    <AgentForm action={updateAgent} agent={agent}/>
    <section className="section"><div className="eyebrow">Governed capability map</div><h2>Assigned skills</h2><p className="lede">Assignments are organization-scoped and validated by the database.</p>
      <div className="agent-skill-grid section">{assigned.length?assigned.map(item=>{const skill=one(item.skills);return <article className="agent-skill-card" key={item.skill_id}><div><Link href={`/skills/${item.skill_id}`}><strong>{skill?.name ?? "Unknown skill"}</strong></Link><span>{skill?.category ?? "Uncategorized"} · {skill?.source_name ?? "Unknown source"}</span></div><form action={removeAgentSkill}><input type="hidden" name="agentId" value={id}/><input type="hidden" name="skillId" value={item.skill_id}/><button className="text-button">Remove</button></form></article>}) : <div className="empty">No skills assigned.</div>}</div>
      <form action={assignAgentSkill} className="form panel compact-form"><input type="hidden" name="agentId" value={id}/><label>Assign governed skill<select name="skillId" required defaultValue=""><option value="" disabled>Select a skill</option>{available.map(skill=><option key={skill.id} value={skill.id}>{skill.name} · {skill.category ?? "Uncategorized"}</option>)}</select></label><button className="button" disabled={!available.length}>Assign skill</button></form>
    </section>
    <section className="section"><div className="eyebrow">Deny by default</div><h2>Tool permissions</h2><p className="lede">Every write grant requires human approval. Mission Control provides no autonomous tool runtime.</p><form action={saveToolPermission} className="form panel"><input type="hidden" name="agentId" value={id}/><div className="form-grid"><label>Tool key<input name="toolKey" required placeholder="knowledge.search"/></label><label className="check"><input type="checkbox" name="canRead"/> Read</label><label className="check"><input type="checkbox" name="canWrite"/> Write</label></div><button className="button">Save permission</button></form><div className="table section">{permissions?.length?permissions.map(permission=><div className="permission-row" key={permission.tool_key}><code>{permission.tool_key}</code><span>read: {permission.can_read?"allow":"deny"}</span><span>write: {permission.can_write?"approval required":"deny"}</span></div>):<div className="empty">No tool grants. All access is denied.</div>}</div></section>
  </>;
}
