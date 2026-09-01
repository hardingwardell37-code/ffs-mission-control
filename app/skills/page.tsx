import Link from "next/link";
import { SkillForm } from "@/components/skill-form";
import { createSkill } from "@/lib/actions";
import { requireContext } from "@/lib/auth";

type SkillRow = { id:string; name:string; slug:string; category:string|null; source_name:string; status:string; agent_skills:Array<{count:number}> };

export default async function SkillsPage() {
  const { supabase, organizationId } = await requireContext();
  const { data, error } = await supabase.from("skills").select("id,name,slug,category,source_name,status,agent_skills(count)").eq("organization_id", organizationId).is("archived_at", null).order("category").order("name");
  const skills = (data ?? []) as unknown as SkillRow[];
  return <>
    <div className="section-head"><div><div className="eyebrow">Governed capabilities</div><h1>Skill Registry</h1></div><span className="status"><span className="dot"/>{skills.length} active records</span></div>
    <p className="lede">Reusable capability metadata, provenance, and explicit agent assignments. Instructions stay at their source; Mission Control stores governed references.</p>
    {error ? <div className="error">Unable to load skills: {error.message}</div> : <section className="skill-registry section" aria-label="Registered skills">
      <div className="skill-registry-head"><span>Skill</span><span>Category</span><span>Source</span><span>Assignments</span><span>Status</span></div>
      {skills.length ? skills.map(skill => <Link className="skill-registry-row" href={`/skills/${skill.id}`} key={skill.id}>
        <div><strong>{skill.name}</strong><small>{skill.slug}</small></div><span>{skill.category ?? "Uncategorized"}</span><span>{skill.source_name}</span><strong>{skill.agent_skills?.[0]?.count ?? 0}</strong><span className={`badge ${skill.status}`}>{skill.status}</span>
      </Link>) : <div className="empty">No governed skills registered.</div>}
    </section>}
    <section className="section"><div className="eyebrow">Registry control</div><h2>Register skill metadata</h2><p className="lede">Store a concise description and source reference, not the full external instruction document.</p><SkillForm action={createSkill}/></section>
  </>;
}
