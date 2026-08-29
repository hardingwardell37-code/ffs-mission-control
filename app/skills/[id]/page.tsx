import { notFound } from "next/navigation";
import { SkillForm } from "@/components/skill-form";
import { archiveSkill, assignAgentSkill, removeAgentSkill, updateSkill } from "@/lib/actions";
import { requireContext } from "@/lib/auth";

type Assignment = { agent_id:string; agents:{id:string;name:string;department:string|null;status:string}|Array<{id:string;name:string;department:string|null;status:string}>|null };
const one = <T,>(value:T|T[]|null) => Array.isArray(value) ? value[0] ?? null : value;

export default async function SkillDetail({ params }: { params:Promise<{id:string}> }) {
  const { id } = await params; const { supabase, organizationId } = await requireContext();
  const [{ data:skill },{ data:assignments },{ data:agents }] = await Promise.all([
    supabase.from("skills").select("*").eq("id",id).eq("organization_id",organizationId).is("archived_at",null).maybeSingle(),
    supabase.from("agent_skills").select("agent_id,agents(id,name,department,status)").eq("skill_id",id).eq("organization_id",organizationId).order("assigned_at"),
    supabase.from("agents").select("id,name,department").eq("organization_id",organizationId).is("archived_at",null).order("name")
  ]);
  if(!skill) notFound();
  const assigned=(assignments ?? []) as unknown as Assignment[]; const assignedIds=new Set(assigned.map(item=>item.agent_id)); const available=(agents ?? []).filter(agent=>!assignedIds.has(agent.id));
  return <>
    <div className="eyebrow">Skill Registry / {skill.slug}</div><div className="section-head"><div><h1>{skill.name}</h1><p className="lede">{skill.category ?? "Uncategorized"} · {skill.source_name}</p></div><a className="button secondary" href={skill.source_url} target="_blank" rel="noreferrer">Open source ↗</a></div>
    <SkillForm action={updateSkill} skill={skill}/>
    <section className="section"><div className="eyebrow">Explicit mapping</div><h2>Assigned agents</h2>
      <div className="skill-assignment-list section">{assigned.length ? assigned.map(item=>{const agent=one(item.agents);return <div className="skill-assignment" key={item.agent_id}><div><strong>{agent?.name ?? "Unknown agent"}</strong><span>{agent?.department ?? "No department"} · {agent?.status ?? "unknown"}</span></div><form action={removeAgentSkill}><input type="hidden" name="agentId" value={item.agent_id}/><input type="hidden" name="skillId" value={id}/><button className="text-button">Remove</button></form></div>}) : <div className="empty">No agents assigned.</div>}</div>
      <form action={assignAgentSkill} className="form panel compact-form"><input type="hidden" name="skillId" value={id}/><label>Assign to agent<select name="agentId" required defaultValue=""><option value="" disabled>Select an agent</option>{available.map(agent=><option key={agent.id} value={agent.id}>{agent.name}{agent.department?` · ${agent.department}`:""}</option>)}</select></label><button className="button" disabled={!available.length}>Assign skill</button></form>
    </section>
    <section className="section danger-zone"><div><div className="eyebrow">Registry lifecycle</div><h2>Archive skill</h2><p className="muted">Removes the skill from active selection while preserving audit history.</p></div><form action={archiveSkill}><input type="hidden" name="id" value={id}/><button className="button secondary">Archive</button></form></section>
  </>;
}
