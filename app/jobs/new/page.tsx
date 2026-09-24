import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { createStudioJobAction } from "@/lib/actions";
import { STUDIO_JOB_SOURCES } from "@/lib/domain/studio-job";

export default async function NewJobPage() {
  await requireContext();

  return (
    <>
      <div className="eyebrow"><Link href="/jobs">Jobs</Link> / New</div>
      <h1>New job</h1>
      <p className="lede">
        Paste an Upwork, Fiverr, email, or other brief. Optional mock analysis drafts deliverables and
        a workflow using existing providers only — it does not generate media.
      </p>

      <form action={createStudioJobAction} className="form panel">
        <div className="eyebrow">Intake</div>
        <div className="form-grid">
          <label>Source
            <select name="source" required defaultValue="intake">
              {STUDIO_JOB_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>Title
            <input name="title" required maxLength={200} placeholder="Brand film — autumn drop" />
          </label>
          <label>Client budget (USD)
            <input name="clientBudgetDollars" type="number" min="0" step="0.01" placeholder="3500" />
          </label>
          <label>Quoted price (USD)
            <input name="quotedPriceDollars" type="number" min="0" step="0.01" placeholder="3200" />
          </label>
          <label>Max production budget (USD)
            <input name="maxProductionBudgetDollars" type="number" min="0" step="0.01" placeholder="900" />
          </label>
          <label>Deadline
            <input name="deadline" type="datetime-local" />
          </label>
          <label>Channel fee (bps)
            <input name="channelFeeBps" type="number" min="0" max="10000" defaultValue={0} />
          </label>
          <label>Contingency (bps)
            <input name="contingencyBps" type="number" min="0" max="10000" defaultValue={1000} />
          </label>
        </div>
        <label>Raw brief
          <textarea
            name="rawBrief"
            required
            rows={12}
            maxLength={50000}
            placeholder="Paste the client brief here…"
          />
        </label>
        <label>Client notes
          <textarea name="clientNotes" rows={3} maxLength={20000} placeholder="Internal notes, channel quirks…" />
        </label>
        <label className="check">
          <input type="checkbox" name="runMockAnalysis" value="on" defaultChecked />
          Run mock brief analysis after create (sets status to needs_review)
        </label>
        <div className="inline">
          <button className="button" type="submit">Create job</button>
          <Link className="button secondary" href="/jobs">Cancel</Link>
        </div>
      </form>
    </>
  );
}
