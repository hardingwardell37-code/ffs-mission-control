import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { createCampaign } from "@/lib/actions";

export default async function CampaignsPage() {
  const { supabase, organizationId } = await requireContext();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id,name,slug,status,entry_mode,product_url,updated_at,created_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Campaign core</div>
          <h1>Campaigns</h1>
        </div>
      </div>
      <p className="lede">
        Every job begins as a campaign. Start from research, a product URL, uploads, or a hybrid intake.
        Generation providers arrive in Phase 2 — provenance and DNA land here first.
      </p>

      <form action={createCampaign} className="form panel">
        <div className="eyebrow">New campaign</div>
        <div className="form-grid">
          <label>Name<input name="name" required maxLength={160} placeholder="Spring drop — brand film" /></label>
          <label>Slug (optional)<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="auto from name" /></label>
          <label>Entry mode
            <select name="entryMode" required defaultValue="research">
              <option value="research">research</option>
              <option value="product_url">product_url</option>
              <option value="upload">upload</option>
              <option value="hybrid">hybrid</option>
            </select>
          </label>
          <label>Product URL<input name="productUrl" type="url" placeholder="https://…" /></label>
        </div>
        <label>Brief<textarea name="brief" rows={4} maxLength={12000} placeholder="What are we making, for whom, and what must be true?" /></label>
        <button className="button" type="submit">Create campaign</button>
      </form>

      {error ? (
        <div className="error">Unable to load campaigns: {error.message}. Apply migration <code>0003_campaign_core.sql</code> if tables are missing.</div>
      ) : (
        <div className="table section">
          <div className="row header"><div>Campaign</div><div>Entry</div><div>Status</div><div>Updated</div></div>
          {data?.length ? data.map((c) => (
            <div className="row" key={c.id}>
              <div>
                <Link href={`/campaigns/${c.id}`}><strong>{c.name}</strong></Link>
                <div className="muted">{c.slug}{c.product_url ? ` · ${c.product_url}` : ""}</div>
              </div>
              <div>{c.entry_mode}</div>
              <div><span className={`badge ${c.status}`}>{c.status}</span></div>
              <time>{new Date(c.updated_at).toLocaleString()}</time>
            </div>
          )) : (
            <div className="empty">No campaigns yet. Create the first workspace above.</div>
          )}
        </div>
      )}
    </>
  );
}
