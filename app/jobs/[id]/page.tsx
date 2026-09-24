import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/auth";
import { addStudioJobRevision, runMockJobAnalysis } from "@/lib/actions";
import { STUDIO_JOB_APPROVAL_KEYS, computeExpectedGrossMargin } from "@/lib/domain/studio-job";
import type { JobWorkflowStep } from "@/types/domain";

const TABS = [
  ["brief", "Brief"],
  ["decision", "Decision"],
  ["workflow", "Workflow"],
  ["costs", "Costs"],
  ["outputs", "Outputs"],
  ["revisions", "Revisions"],
] as const;

type Tab = (typeof TABS)[number][0];

function formatCents(cents: number | null | undefined): string {
  if (cents == null) return "—";
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asSteps(value: unknown): JobWorkflowStep[] {
  if (!Array.isArray(value)) return [];
  return value as JobWorkflowStep[];
}

function isMissingRelation(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find the table");
}

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tab = (TABS.some(([k]) => k === sp.tab) ? sp.tab : "brief") as Tab;
  const { supabase, organizationId } = await requireContext();

  const jobResult = await supabase
    .from("studio_jobs")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (jobResult.error && isMissingRelation(jobResult.error.message)) {
    return (
      <>
        <div className="eyebrow"><Link href="/jobs">Jobs</Link></div>
        <h1>Job Operator</h1>
        <div className="error">
          Tables missing. Apply migration <code>0007_studio_jobs.sql</code>, then reload.
        </div>
      </>
    );
  }

  const job = jobResult.data;
  if (!job) notFound();

  const [
    { data: analysis },
    { data: workflow },
    { data: revisions },
    { data: generations },
    { data: campaign },
  ] = await Promise.all([
    supabase.from("brief_analyses").select("*").eq("studio_job_id", id).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("job_workflows").select("*").eq("studio_job_id", id).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("job_revisions").select("*").eq("studio_job_id", id).eq("organization_id", organizationId).order("created_at", { ascending: false }),
    supabase
      .from("generation_jobs")
      .select("id,modality,provider,model_name,status,prompt,error_message,campaign_id,created_at,completed_at")
      .eq("studio_job_id", id)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(50),
    job.campaign_id
      ? supabase.from("campaigns").select("id,name,slug").eq("id", job.campaign_id).eq("organization_id", organizationId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const steps = asSteps(workflow?.steps);
  const estimatedGen = workflow?.estimated_total_cost_cents ?? steps.reduce((s, step) => s + (step.estimatedTotalCents ?? 0), 0);
  const quote = job.quoted_price_cents ?? 0;
  const margin = computeExpectedGrossMargin({
    quotedPriceCents: quote,
    estimatedGenCents: estimatedGen ?? 0,
    contingencyBps: job.contingency_bps ?? 1000,
    channelFeeBps: job.channel_fee_bps ?? 0,
  });

  return (
    <>
      <div className="eyebrow"><Link href="/jobs">Jobs</Link> / {job.source}</div>
      <h1>{job.title}</h1>
      <p className="lede">
        Status: <span className={`badge ${job.status}`}>{job.status}</span>
        {job.deadline ? <> · Deadline {new Date(job.deadline).toLocaleString()}</> : null}
      </p>

      <nav className="tabs">
        {TABS.map(([key, label]) => (
          <Link key={key} href={`/jobs/${id}?tab=${key}`} className={tab === key ? "tab active" : "tab"}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "brief" && (
        <section className="section">
          <div className="panel">
            <div className="eyebrow">Brief</div>
            <div className="form-grid">
              <div><div className="label">Source</div><div>{job.source}</div></div>
              <div><div className="label">Status</div><div><span className={`badge ${job.status}`}>{job.status}</span></div></div>
              <div><div className="label">Client budget</div><div>{formatCents(job.client_budget_cents)}</div></div>
              <div><div className="label">Quoted price</div><div>{formatCents(job.quoted_price_cents)}</div></div>
              <div><div className="label">Max production</div><div>{formatCents(job.max_production_budget_cents)}</div></div>
              <div><div className="label">Deadline</div><div>{job.deadline ? new Date(job.deadline).toLocaleString() : "—"}</div></div>
              <div>
                <div className="label">Campaign</div>
                <div>
                  {campaign ? (
                    <Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
                  ) : (
                    <span className="muted">None linked (Phase 3 bridges generation)</span>
                  )}
                </div>
              </div>
            </div>
            <div className="section">
              <div className="label">Raw brief</div>
              <pre className="brief-block">{job.raw_brief}</pre>
            </div>
            {job.client_notes ? (
              <div className="section">
                <div className="label">Client notes</div>
                <p>{job.client_notes}</p>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {tab === "decision" && (
        <section className="section">
          {!analysis ? (
            <div className="panel">
              <div className="eyebrow">Decision</div>
              <h2>No analysis yet</h2>
              <p className="muted">Run mock heuristics against the brief. model_used will be <code>mock</code> only.</p>
              <form action={runMockJobAnalysis}>
                <input type="hidden" name="studioJobId" value={id} />
                <button className="button" type="submit">Run mock analysis</button>
              </form>
            </div>
          ) : (
            <div className="panel">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Decision</div>
                  <h2>
                    <span className={`badge ${analysis.decision}`}>{analysis.decision}</span>
                    {" "}confidence {analysis.confidence != null ? Number(analysis.confidence).toFixed(2) : "—"}
                  </h2>
                </div>
                <form action={runMockJobAnalysis}>
                  <input type="hidden" name="studioJobId" value={id} />
                  <button className="button secondary" type="submit">Re-run mock analysis</button>
                </form>
              </div>
              <p>{analysis.rationale}</p>
              <div className="muted">model_used: {analysis.model_used}</div>
              <div className="form-grid section">
                <div>
                  <div className="label">Deliverables</div>
                  <ul className="plain-list">{asList(analysis.deliverables).map((d, i) => <li key={i}>{String(d)}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Dimensions</div>
                  <ul className="plain-list">{asList(analysis.dimensions).map((d, i) => <li key={i}>{String(d)}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Durations</div>
                  <ul className="plain-list">{asList(analysis.durations).map((d, i) => <li key={i}>{String(d)}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Exact text</div>
                  <ul className="plain-list">{asList(analysis.exact_text).map((d, i) => <li key={i}>{String(d)}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Brand constraints</div>
                  <ul className="plain-list">{asList(analysis.brand_constraints).map((d, i) => <li key={i}>{String(d)}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Rights concerns</div>
                  <ul className="plain-list">{asList(analysis.rights_concerns).map((d, i) => <li key={i}>{String(d)}</li>)}</ul>
                </div>
                <div>
                  <div className="label">Missing information</div>
                  <ul className="plain-list">{asList(analysis.missing_information).map((d, i) => <li key={i}>{String(d)}</li>)}</ul>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "workflow" && (
        <section className="section">
          <div className="panel">
            <div className="eyebrow">Workflow</div>
            <h2>
              Approval:{" "}
              <span className={`badge ${workflow?.approval_status ?? "draft"}`}>
                {workflow?.approval_status ?? "none"}
              </span>
            </h2>
            <p className="muted">
              Human gates (approvals.action_key): {STUDIO_JOB_APPROVAL_KEYS.join(", ")}. Phase 1 surfaces
              these; approval mutations that run generation ship in Phase 3.
            </p>
            <div className="chip-row">
              {STUDIO_JOB_APPROVAL_KEYS.map((key) => (
                <span className="chip gate-chip" key={key}>{key}</span>
              ))}
            </div>
            {steps.length ? (
              <div className="table section">
                <div className="row header workflow-row">
                  <div>#</div><div>Step</div><div>Provider</div><div>Est.</div>
                </div>
                {steps.map((step) => (
                  <div className="row workflow-row" key={step.order}>
                    <div>{step.order}</div>
                    <div>
                      <strong>{step.purpose}</strong>
                      <div className="muted">{step.modality} · {step.model} · {step.estimatedAttempts} attempts</div>
                    </div>
                    <div>{step.provider}</div>
                    <div>{formatCents(step.estimatedTotalCents)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">No workflow draft. Run mock analysis from the Decision tab.</div>
            )}
          </div>
        </section>
      )}

      {tab === "costs" && (
        <section className="section">
          <div className="panel">
            <div className="eyebrow">Costs</div>
            <h2>Profitability (estimate)</h2>
            <div className="grid cost-grid">
              <div className="card"><div className="label">Client quote</div><div className="metric small">{formatCents(job.quoted_price_cents)}</div></div>
              <div className="card"><div className="label">Est. gen spend</div><div className="metric small">{formatCents(estimatedGen)}</div></div>
              <div className="card"><div className="label">+ Contingency ({job.contingency_bps} bps)</div><div className="metric small">{formatCents(margin.genWithContingencyCents)}</div></div>
              <div className="card"><div className="label">Channel fee ({job.channel_fee_bps} bps)</div><div className="metric small">{formatCents(margin.channelFeeCents)}</div></div>
            </div>
            <div className="card section">
              <div className="label">Expected gross margin</div>
              <div className="metric">{formatCents(margin.expectedGrossMarginCents)}</div>
              <p className="muted">quote − channel fee − gen×(1+contingency). Mock estimates only.</p>
            </div>
            <div className="section">
              <div className="label">Human approval timeline</div>
              <ol className="plain-list numbered">
                <li><code>job_workflow</code> — approve production step plan before spend</li>
                <li><code>job_budget</code> — confirm quote covers gen + contingency + channel fee</li>
                <li><code>job_rights</code> — clear rights / IP flags from brief analysis</li>
                <li><code>job_delivery</code> — approve client delivery (after QA)</li>
              </ol>
            </div>
          </div>
        </section>
      )}

      {tab === "outputs" && (
        <section className="section">
          <div className="panel">
            <div className="eyebrow">Outputs</div>
            <h2>Linked generation jobs</h2>
            {generations?.length ? (
              <div className="table section">
                <div className="row header job-row"><div>Job</div><div>Provider</div><div>Status</div><div>Created</div></div>
                {generations.map((g) => (
                  <div className="row job-row" key={g.id}>
                    <div>
                      <strong>{g.modality}</strong>
                      <div className="muted">{(g.prompt as string)?.slice(0, 80)}</div>
                    </div>
                    <div>{g.provider}{g.model_name ? ` / ${g.model_name}` : ""}</div>
                    <div><span className={`badge ${g.status}`}>{g.status}</span></div>
                    <time>{new Date(g.created_at).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty">No generations yet — Phase 3 bridges to Generate via studio_job_id.</div>
            )}
          </div>
        </section>
      )}

      {tab === "revisions" && (
        <section className="section">
          <form action={addStudioJobRevision} className="form panel">
            <input type="hidden" name="studioJobId" value={id} />
            <div className="eyebrow">Revisions</div>
            <h2>Add revision note</h2>
            <label>Client note<textarea name="clientNote" required rows={3} maxLength={8000} /></label>
            <div className="form-grid">
              <label>Affected deliverable<input name="affectedDeliverable" maxLength={400} /></label>
              <label>Incremental cost (USD)<input name="expectedIncrementalCostDollars" type="number" min="0" step="0.01" /></label>
            </div>
            <label>Recommended action<textarea name="recommendedAction" rows={2} maxLength={4000} /></label>
            <button className="button" type="submit">Add revision</button>
          </form>
          <div className="table section">
            <div className="row header research-row"><div>Note</div><div>Deliverable</div><div>Status</div><div>Added</div></div>
            {revisions?.length ? revisions.map((r) => (
              <div className="row research-row" key={r.id}>
                <div>
                  <strong>{r.client_note}</strong>
                  {r.recommended_action ? <div className="muted">{r.recommended_action}</div> : null}
                  {r.expected_incremental_cost_cents != null ? (
                    <div className="muted">+{formatCents(r.expected_incremental_cost_cents)}</div>
                  ) : null}
                </div>
                <div>{r.affected_deliverable || "—"}</div>
                <div><span className={`badge ${r.approval_status}`}>{r.approval_status}</span></div>
                <time>{new Date(r.created_at).toLocaleString()}</time>
              </div>
            )) : <div className="empty">No revision notes yet.</div>}
          </div>
        </section>
      )}
    </>
  );
}
