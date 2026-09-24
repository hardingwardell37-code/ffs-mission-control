import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { seedDemoStudioJobs } from "@/lib/actions";
import { STUDIO_JOB_STATUSES } from "@/lib/domain/studio-job";
import type { StudioJobStatus } from "@/types/domain";

const STATUS_LABELS: Record<StudioJobStatus, string> = {
  new: "New",
  needs_review: "Needs Review",
  approved: "Approved",
  generating: "Generating",
  qa: "QA",
  delivered: "Delivered",
  rejected: "Rejected",
};

function formatCents(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function isMissingRelation(message: string | undefined): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return m.includes("studio_jobs") || m.includes("does not exist") || m.includes("schema cache") || m.includes("could not find the table");
}

type JobRow = {
  id: string;
  title: string;
  source: string;
  status: StudioJobStatus;
  quoted_price_cents: number | null;
  client_budget_cents: number | null;
  deadline: string | null;
  created_at: string;
};

export default async function JobsPage() {
  const { supabase, organizationId } = await requireContext();
  const { data, error } = await supabase
    .from("studio_jobs")
    .select("id,title,source,status,quoted_price_cents,client_budget_cents,deadline,created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  const missing = error && isMissingRelation(error.message);
  const jobs = (data ?? []) as JobRow[];
  const byStatus = Object.fromEntries(
    STUDIO_JOB_STATUSES.map((s) => [s, jobs.filter((j) => j.status === s)]),
  ) as Record<StudioJobStatus, JobRow[]>;

  return (
    <>
      <div className="section-head">
        <div>
          <div className="eyebrow">Job Operator</div>
          <h1>Jobs</h1>
        </div>
        <div className="inline">
          <Link className="button" href="/jobs/new">New Job</Link>
          {!missing && jobs.length === 0 ? (
            <form action={seedDemoStudioJobs}>
              <button className="button secondary" type="submit">Seed demo jobs</button>
            </form>
          ) : null}
        </div>
      </div>
      <p className="lede">
        Marketplace-agnostic intake → qualify → price → approve. Paste briefs manually.
        Analysis is mock heuristics only until Phase 2 — never claimed as live generation.
      </p>

      {error ? (
        <div className="error">
          {missing ? (
            <>
              Job Operator tables are missing. Apply migration <code>0007_studio_jobs.sql</code> in the
              Supabase SQL editor (or CLI), then reload this page.
            </>
          ) : (
            <>Unable to load jobs: {error.message}</>
          )}
        </div>
      ) : (
        <>
          {jobs.length === 0 ? (
            <div className="empty section">
              No jobs yet. Create one with <strong>New Job</strong>, or load two realistic demo briefs
              with <strong>Seed demo jobs</strong> (idempotent by title).
            </div>
          ) : null}
          <div className="job-board section">
            {STUDIO_JOB_STATUSES.map((status) => (
              <section className="job-column" key={status}>
                <header className="job-column-head">
                  <span>{STATUS_LABELS[status]}</span>
                  <span className="muted">{byStatus[status].length}</span>
                </header>
                <div className="job-column-body">
                  {byStatus[status].length ? byStatus[status].map((job) => {
                    const quote = formatCents(job.quoted_price_cents);
                    const budget = formatCents(job.client_budget_cents);
                    return (
                      <Link className="job-card" key={job.id} href={`/jobs/${job.id}`}>
                        <strong>{job.title}</strong>
                        <div className="muted">{job.source}</div>
                        {(quote || budget) ? (
                          <div className="muted">
                            {quote ? `Quote ${quote}` : null}
                            {quote && budget ? " · " : null}
                            {budget ? `Budget ${budget}` : null}
                          </div>
                        ) : null}
                        {job.deadline ? (
                          <div className="muted">Due {new Date(job.deadline).toLocaleString()}</div>
                        ) : null}
                      </Link>
                    );
                  }) : (
                    <div className="job-column-empty">—</div>
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
