"use client";

import { useMemo, useState, useTransition } from "react";
import { cancelGenerationJob, createGenerationJob, runGenerationJob } from "@/lib/actions";
import { AssetMediaPreview } from "@/components/asset-preview";

type AssetOption = {
  id: string;
  title: string;
  role: string;
  mime_type: string | null;
};

type JobRow = {
  id: string;
  modality: string;
  provider: string;
  model_name: string | null;
  status: string;
  prompt: string;
  error_message: string | null;
  result_asset_id: string | null;
  result_storage_url?: string | null;
  result_mime_type?: string | null;
  result_title?: string | null;
  created_at: string;
  completed_at: string | null;
};

export function GenerationPanel({
  campaignId,
  assets,
  jobs,
}: {
  campaignId: string;
  assets: AssetOption[];
  jobs: JobRow[];
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [modality, setModality] = useState<"image" | "video">("image");
  const [refs, setRefs] = useState<string[]>([]);
  const [locks, setLocks] = useState<string[]>([]);

  const selectable = useMemo(
    () => assets.filter((a) => a.role !== "generated" || true),
    [assets],
  );

  function toggle(list: string[], id: string, set: (v: string[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("campaignId", campaignId);
    fd.set("modality", modality);
    fd.delete("referenceAssetIds");
    fd.delete("lockedAssetIds");
    for (const id of refs) fd.append("referenceAssetIds", id);
    for (const id of locks) fd.append("lockedAssetIds", id);
    fd.set("runNow", "true");

    startTransition(async () => {
      try {
        await createGenerationJob(fd);
        form.reset();
        setRefs([]);
        setLocks([]);
        setMessage("Generation job queued and started. If keys are missing, the job fails with not_configured — that is expected until you set provider env vars.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to create generation job");
      }
    });
  }

  function runJob(jobId: string) {
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("campaignId", campaignId);
    startTransition(async () => {
      try {
        await runGenerationJob(fd);
        setMessage("Job run requested.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to run job");
      }
    });
  }

  function cancelJob(jobId: string) {
    const fd = new FormData();
    fd.set("jobId", jobId);
    fd.set("campaignId", campaignId);
    startTransition(async () => {
      try {
        await cancelGenerationJob(fd);
        setMessage("Job cancelled.");
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to cancel job");
      }
    });
  }

  return (
    <section className="section">
      <form onSubmit={onCreate} className="form panel">
        <div className="eyebrow">Phase 2 · Generation</div>
        <h2>Generate image or video</h2>
        <p className="muted">
          Write an <strong>original</strong> prompt. Do not paste copyrighted source creatives or ask to
          &ldquo;generate this exact ad.&rdquo; Research inspires direction; outputs stay draft until approval gates.
        </p>
        <div className="form-grid">
          <label>
            Modality
            <select
              name="modality"
              value={modality}
              onChange={(e) => setModality(e.target.value as "image" | "video")}
            >
              <option value="image">image</option>
              <option value="video">video</option>
            </select>
          </label>
          <label>
            Provider
            <select name="provider" defaultValue="auto">
              <option value="auto">Auto (env-aware)</option>
              <option value="runway">Runway Image</option>
              <option value="grok_imagine">Grok Imagine</option>
              <option value="openai_image">OpenAI Image</option>
              <option value="google_omni">Google Omni</option>
              <option value="fal_minimax_h3">fal MiniMax H3</option>
              <option value="fal_minimax_h3_max">fal MiniMax H3 Max</option>
            </select>
          </label>
        </div>
        <label>
          Prompt
          <textarea
            name="prompt"
            rows={5}
            required
            maxLength={12000}
            placeholder="Original cinematic still: product on brushed steel, directional arena light, no logos from competitor ads…"
          />
        </label>
        <label>
          Negative prompt (optional)
          <textarea name="negativePrompt" rows={2} maxLength={4000} placeholder="blurry, watermark, brand marks…" />
        </label>
        <p className="muted">
          Runway Gen-4 / Muse <code>promptText</code> max is <strong>1000 UTF-16</strong>; GPT Image 2 allows up to <strong>32000</strong>.
          Over-limit prompts fail clearly so Prompt Engineer can rewrite — no silent truncation.
        </p>
        <label>
          Model
          <select name="modelName" defaultValue="">
            <option value="">Provider default (Runway: GPT Image 2)</option>
            <option value="gpt_image_2">GPT Image 2 (1–41 credits by quality)</option>
            <option value="gen4_image_turbo">Gen-4 Image Turbo (2 credits)</option>
            <option value="muse_image">Muse Image (1 credit)</option>
            <option value="gen4_image">Gen-4 Image (5–8 credits)</option>
          </select>
        </label>

        <div className="section">
          <div className="eyebrow">References</div>
          <p className="muted">Multi-select campaign assets as soft references (same campaign only).</p>
          <div className="chip-row">
            {selectable.length ? selectable.map((a) => (
              <label key={a.id} className="chip" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={refs.includes(a.id)}
                  onChange={() => toggle(refs, a.id, setRefs)}
                />{" "}
                {a.title} <span className="muted">({a.role})</span>
              </label>
            )) : <span className="muted">No assets yet — add some under Assets.</span>}
          </div>
        </div>

        <div className="section">
          <div className="eyebrow">Locks</div>
          <p className="muted">Optional locked assets the generation should respect (still same-campaign only).</p>
          <div className="chip-row">
            {selectable.filter((a) => a.role === "locked" || a.role === "source").map((a) => (
              <label key={a.id} className="chip" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={locks.includes(a.id)}
                  onChange={() => toggle(locks, a.id, setLocks)}
                />{" "}
                {a.title}
              </label>
            ))}
            {!selectable.some((a) => a.role === "locked" || a.role === "source") ? (
              <span className="muted">No locked/source assets marked yet.</span>
            ) : null}
          </div>
        </div>

        <button className="button" type="submit" disabled={pending}>
          {pending ? "Working…" : "Create & run job"}
        </button>
        {message ? <p className="muted">{message}</p> : null}
      </form>

      <div className="table section">
        <div className="row header job-row">
          <div>Job</div>
          <div>Provider / model</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {jobs.length ? jobs.map((j) => (
          <div className="row job-row" key={j.id}>
            <div>
              <strong>{j.modality}</strong>
              <div className="muted">{j.prompt.slice(0, 120)}{j.prompt.length > 120 ? "…" : ""}</div>
              <time className="muted">{new Date(j.created_at).toLocaleString()}</time>
              {j.result_asset_id ? (
                <div className="muted">result asset: {j.result_asset_id.slice(0, 8)}…</div>
              ) : null}
              {j.status === "succeeded" && (j.result_storage_url || j.result_asset_id) ? (
                <div className="job-result-preview">
                  <AssetMediaPreview
                    compact
                    title={j.result_title || "Generated result"}
                    mimeType={j.result_mime_type}
                    storageUrl={j.result_storage_url}
                  />
                </div>
              ) : null}
              {j.error_message ? <div className="muted">{j.error_message}</div> : null}
            </div>
            <div>
              <span className="badge">{j.provider}</span>
              <div className="muted">{j.model_name || "default"}</div>
            </div>
            <div>
              <span className={`badge ${j.status}`}>{j.status}</span>
            </div>
            <div className="chip-row">
              {(j.status === "queued" || j.status === "failed") && (
                <button type="button" className="button secondary" disabled={pending} onClick={() => runJob(j.id)}>
                  Run
                </button>
              )}
              {(j.status === "queued" || j.status === "running" || j.status === "failed") && (
                <button type="button" className="button secondary" disabled={pending} onClick={() => cancelJob(j.id)}>
                  Cancel
                </button>
              )}
              {j.result_asset_id ? (
                <a className="button secondary" href={`/campaigns/${campaignId}?tab=assets`}>
                  View assets
                </a>
              ) : null}
            </div>
          </div>
        )) : (
          <div className="empty">No generation jobs yet. Create one above — without API keys the run fails clearly with not_configured.</div>
        )}
      </div>
    </section>
  );
}
