# Job Operator — Phase 1

**Product:** F&P Studio (unchanged)  
**Module:** Job Operator  
**Branch:** `fp-studio/job-operator-phase-1`  
**Depends on:** Phase 0 schema (`0007_studio_jobs.sql`) merged via PR #24

---

## What shipped

1. **Nav** — Sidebar **Jobs** → `/jobs` (after Campaigns)
2. **`/jobs` pipeline board** — columns for every `studio_job_status`: New, Needs Review, Approved, Generating, QA, Delivered, Rejected
3. **`/jobs/new` intake** — source, title, raw brief, notes, budgets (USD → cents), fee/contingency bps, deadline; optional mock analysis on create
4. **`/jobs/[id]` tabs** — Brief | Decision | Workflow | Costs | Outputs | Revisions
5. **Mock analysis** — `lib/studio-jobs/mock-analysis.ts` (`model_used: mock` only)
6. **Demo seeds** — idempotent **Seed demo jobs** button on empty board (`lib/studio-jobs/fixtures.ts`)
7. **Server actions** — create, mock analyze, add revision, seed demos (same `requireContext` / org patterns as campaigns)
8. **Graceful missing-table state** — if `0007` not applied, board/detail show apply-migration message instead of crashing

---

## Manual proof (after migration 0007)

1. Sign in (or personal bypass when enabled)
2. Open **Jobs** in the sidebar
3. If empty: click **Seed demo jobs** → two cards appear (Northline cinematic + Pulse social)
4. Open Northline → Decision / Workflow / Costs tabs populated from mock analysis
5. **New Job** → paste a brief → create with mock analysis → lands in Needs Review
6. Revisions tab → add a note

Live DB reminder: apply `supabase/migrations/0007_studio_jobs.sql` before relying on tables.

---

## Demo seeds

| Title | Source | Intent |
| --- | --- | --- |
| Northline — 60s cinematic concept film | email | Longer film brief, ~$2.8–3.9k client budget |
| Pulse App — launch static + 15s social | fiverr | Short contrasting still + social cut |

Idempotent: seed skips titles that already exist for the org. Each insert includes `studio_jobs` + `brief_analyses` + `job_workflows` (providers: runway / openai_image / fal_minimax_h3 / grok_imagine only — **no Higgsfield**).

---

## Explicit non-goals (still out)

- Real LLM brief analysis (Phase 2)
- Approval mutations that enqueue generation (Phase 3)
- Higgsfield or any new media provider
- Marketplace scrape / auto-apply / message / accept / deliver
- Fake successful media generation
- Claiming Astra / GPT-6 Astra

---

## Key paths

| Path | Role |
| --- | --- |
| `app/jobs/page.tsx` | Board |
| `app/jobs/new/page.tsx` | Intake |
| `app/jobs/[id]/page.tsx` | Detail tabs |
| `lib/studio-jobs/mock-analysis.ts` | Heuristics |
| `lib/studio-jobs/fixtures.ts` | Demo briefs |
| `lib/studio-jobs/repository.ts` | Data access |
| `lib/actions.ts` | Server actions |
