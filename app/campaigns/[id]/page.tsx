import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { addResearchSource, updateCampaignBrief, updateCampaignDna } from "@/lib/actions";
import { AssetUploadForm } from "@/components/asset-upload";
import { GenerationPanel } from "@/components/generation-form";
import { AssetMediaPreview } from "@/components/asset-preview";

const TABS = [
  ["overview", "Overview"],
  ["dna", "DNA"],
  ["research", "Research"],
  ["assets", "Assets"],
  ["generate", "Generate"],
] as const;

type Tab = (typeof TABS)[number][0];

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS.some(([k]) => k === sp.tab) ? sp.tab : "overview") as Tab;
  const { supabase, organizationId } = await requireContext();

  const [{ data: campaign }, { data: dna }, { data: sources }, { data: assets }, { data: sections }, { data: jobs }] = await Promise.all([
    supabase.from("campaigns").select("*").eq("id", id).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("campaign_dna").select("*").eq("campaign_id", id).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("research_sources").select("*").eq("campaign_id", id).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("assets").select("*").eq("campaign_id", id).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase.from("campaign_sections").select("section_key,label,sort_order").eq("campaign_id", id).order("sort_order"),
    supabase.from("generation_jobs").select("id,modality,provider,model_name,status,prompt,error_message,result_asset_id,created_at,completed_at").eq("campaign_id", id).eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(50),
  ]);

  if (!campaign) notFound();

  const assetById = new Map((assets ?? []).map((a) => [a.id as string, a]));

  return (
    <>
      <div className="eyebrow">Campaigns / {campaign.slug}</div>
      <h1>{campaign.name}</h1>
      <p className="lede">
        Entry: <strong>{campaign.entry_mode}</strong> · Status: <span className={`badge ${campaign.status}`}>{campaign.status}</span>
        {campaign.product_url ? <> · <a href={campaign.product_url} target="_blank" rel="noreferrer">{campaign.product_url}</a></> : null}
      </p>

      <nav className="tabs">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/campaigns/${id}?tab=${key}`} className={tab === key ? "tab active" : "tab"}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "overview" && (
        <section className="section">
          <form action={updateCampaignBrief} className="form panel">
            <input type="hidden" name="campaignId" value={id} />
            <div className="form-grid">
              <label>Status
                <select name="status" defaultValue={campaign.status}>
                  <option value="draft">draft</option>
                  <option value="active">active</option>
                  <option value="paused">paused</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <label>Product URL<input name="productUrl" type="url" defaultValue={campaign.product_url ?? ""} /></label>
            </div>
            <label>Brief<textarea name="brief" rows={8} maxLength={12000} defaultValue={campaign.brief ?? ""} /></label>
            <button className="button" type="submit">Save overview</button>
          </form>
          <div className="panel section">
            <div className="eyebrow">Studio folders</div>
            <h2>Campaign structure</h2>
            <p className="muted">Seeded 01–17 sections (Brief → Exports). Phase 1 uses them for asset organization; later phases fill generation and edit surfaces.</p>
            <div className="chip-row">
              {sections?.map((s) => (
                <span className="chip" key={s.section_key}>{String(s.sort_order).padStart(2, "0")} {s.label}</span>
              )) ?? <span className="muted">Sections seed on create via migration trigger.</span>}
            </div>
          </div>
        </section>
      )}

      {tab === "dna" && (
        <section className="section">
          <form action={updateCampaignDna} className="form panel">
            <input type="hidden" name="campaignId" value={id} />
            <div className="eyebrow">Campaign DNA</div>
            <h2>Brand / campaign DNA</h2>
            <p className="muted">Structured record — not free-floating chat. Originality policy is locked as default studio rule.</p>
            <label>Positioning<textarea name="positioning" rows={3} defaultValue={dna?.positioning ?? ""} /></label>
            <label>Audience<textarea name="audience" rows={3} defaultValue={dna?.audience ?? ""} /></label>
            <label>Tone<textarea name="tone" rows={2} defaultValue={dna?.tone ?? ""} /></label>
            <label>Visual direction<textarea name="visualDirection" rows={3} defaultValue={dna?.visual_direction ?? ""} /></label>
            <label>Do-not-copy notes<textarea name="doNotCopyNotes" rows={3} defaultValue={dna?.do_not_copy_notes ?? ""} placeholder="Specific slogans, compositions, or marks that must never be reproduced" /></label>
            <label>Originality policy<textarea name="originalityPolicy" rows={3} defaultValue={dna?.originality_policy ?? "Research inspires direction only. Never copy source wording, imagery, footage, or protected creative execution into final work."} /></label>
            <button className="button" type="submit">Save DNA</button>
          </form>
        </section>
      )}

      {tab === "research" && (
        <section className="section">
          <form action={addResearchSource} className="form panel">
            <input type="hidden" name="campaignId" value={id} />
            <div className="eyebrow">Originality Guard</div>
            <h2>Add research source</h2>
            <p className="muted">Capture what you observed, then write the original direction you will create instead — never auto-copy source creative.</p>
            <div className="form-grid">
              <label>URL<input name="url" type="url" required placeholder="https://…" /></label>
              <label>Title<input name="title" maxLength={200} /></label>
            </div>
            <label>Notes<textarea name="notes" rows={2} /></label>
            <label>Observation (what we learned)<textarea name="observation" rows={3} required placeholder="High-contrast studio lighting, minimal text…" /></label>
            <label>Original direction (what we will create)<textarea name="originalDirection" rows={3} required placeholder="Directional arena lighting, original typography system…" /></label>
            <button className="button" type="submit">Add source</button>
          </form>
          <div className="table section">
            <div className="row header research-row"><div>Source</div><div>Observation</div><div>Original direction</div><div>Added</div></div>
            {sources?.length ? sources.map((s) => (
              <div className="row research-row" key={s.id}>
                <div>
                  <a href={s.url} target="_blank" rel="noreferrer"><strong>{s.title || s.url}</strong></a>
                  {s.notes ? <div className="muted">{s.notes}</div> : null}
                </div>
                <div>{s.observation || "—"}</div>
                <div>{s.original_direction || "—"}</div>
                <time>{new Date(s.created_at).toLocaleString()}</time>
              </div>
            )) : <div className="empty">No research sources yet. Add URLs and convert observations into original direction.</div>}
          </div>
        </section>
      )}

      {tab === "assets" && (
        <section className="section">
          <AssetUploadForm campaignId={id} organizationId={organizationId} />
          {assets?.length ? (
            <div className="asset-grid section">
              {assets.map((a) => (
                <article className="asset-card" key={a.id}>
                  <AssetMediaPreview
                    title={a.title}
                    mimeType={a.mime_type}
                    storageUrl={a.storage_url}
                    storagePath={a.storage_path}
                  />
                  <strong>{a.title}</strong>
                  <div className="muted">
                    {a.mime_type || "unknown type"}
                    {a.section ? ` · ${a.section}` : ""}
                    {a.file_size != null ? ` · ${a.file_size} bytes` : ""}
                  </div>
                  <div className="chip-row">
                    <span className="badge">{a.role}</span>
                    <span className="badge">{a.ownership_status}</span>
                    <span className={`badge ${a.approval_state}`}>{a.approval_state}</span>
                  </div>
                  <div className="muted">origin: {a.origin}</div>
                  {a.storage_path ? <div className="muted">path: {a.storage_path}</div> : null}
                  {a.source_url ? (
                    <div className="muted">
                      <a href={a.source_url} target="_blank" rel="noreferrer">source url</a>
                    </div>
                  ) : null}
                  {a.model_provider ? (
                    <div className="muted">model: {a.model_provider}/{a.model_name}</div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <div className="empty section">No assets yet. Upload a file or register path/URL metadata with ownership and role.</div>
          )}
        </section>
      )}

      {tab === "generate" && (
        <GenerationPanel
          campaignId={id}
          assets={(assets ?? []).map((a) => ({
            id: a.id,
            title: a.title,
            role: a.role,
            mime_type: a.mime_type,
          }))}
          jobs={(jobs ?? []).map((j) => {
            const result = j.result_asset_id ? assetById.get(j.result_asset_id) : undefined;
            return {
              id: j.id,
              modality: j.modality,
              provider: j.provider,
              model_name: j.model_name,
              status: j.status,
              prompt: j.prompt,
              error_message: j.error_message,
              result_asset_id: j.result_asset_id,
              result_storage_url: result?.storage_url ?? null,
              result_mime_type: result?.mime_type ?? null,
              result_title: result?.title ?? null,
              created_at: j.created_at,
              completed_at: j.completed_at,
            };
          })}
        />
      )}
    </>
  );
}
