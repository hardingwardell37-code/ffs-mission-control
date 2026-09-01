export function SkillForm({ action, skill }: { action: (data: FormData) => Promise<void>; skill?: Record<string, string | null> }) {
  return <form action={action} className="form panel skill-form">
    {skill?.id && <input type="hidden" name="id" value={skill.id}/>} 
    <div className="form-grid">
      <label>Name<input name="name" required maxLength={120} defaultValue={skill?.name ?? ""}/></label>
      <label>Slug<input name="slug" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={skill?.slug ?? ""}/></label>
      <label>Category<input name="category" maxLength={80} defaultValue={skill?.category ?? ""}/></label>
      <label>Status<select name="status" defaultValue={skill?.status ?? "active"}><option value="active">active</option><option value="disabled">disabled</option></select></label>
    </div>
    <label>Description<textarea name="description" rows={3} maxLength={1000} defaultValue={skill?.description ?? ""}/></label>
    <div className="form-grid">
      <label>Source name<input name="sourceName" required maxLength={120} defaultValue={skill?.source_name ?? ""}/></label>
      <label>Source URL<input name="sourceUrl" type="url" required maxLength={500} defaultValue={skill?.source_url ?? ""}/></label>
      <label>Source version<input name="sourceVersion" maxLength={80} defaultValue={skill?.source_version ?? ""}/></label>
      <label>Instruction reference<input name="instructionReference" maxLength={500} defaultValue={skill?.instruction_reference ?? ""} placeholder="skills/example/SKILL.md"/></label>
    </div>
    <button className="button" type="submit">Save governed skill</button>
  </form>;
}
