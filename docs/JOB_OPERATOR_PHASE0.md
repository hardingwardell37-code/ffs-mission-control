# Job Operator — Phase 0

**Product:** F&P Studio (unchanged)  
**Module:** Job Operator (marketplace-agnostic intake → qualify → price → approve)  
**Branch:** `fp-studio/job-operator-phase-0`  
**Decision:** Path A — extend the existing Mission Control / F&P Studio app. No greenfield second app. No Higgsfield. No marketplace integrations that scrape, auto-apply, message, accept, or deliver.

---

## What shipped

1. **Migration `0007_studio_jobs.sql`**
   - Enums: `studio_job_source`, `studio_job_status`, `studio_job_decision`, `job_workflow_approval_status`, `job_revision_approval_status`
   - Tables: `studio_jobs`, `brief_analyses` (one current analysis per job), `job_workflows` (one active workflow per job), `job_revisions`
   - Nullable `generation_jobs.studio_job_id` FK (existing `campaign_id` stays NOT NULL)
   - Org RLS via `is_org_member` / `can_manage_org`, `updated_at` touch triggers, same-org validators
2. **Domain / repository TypeScript**
   - `lib/domain/studio-job.ts` — source/status/decision lists, approval action keys, margin helper
   - `lib/studio-jobs/repository.ts` — create/get/list jobs, upsert analysis & workflow, add revision (client injected)
   - Types in `types/domain.ts`
3. **Feature map stub** — `job_operator` notes Phase 0 schema only; Phase 1 UI pending
4. **Tests** — margin helper unit tests; migration policy smoke checks for `0007`

Apply `0007_studio_jobs.sql` in the Supabase SQL editor (or CLI) before relying on these tables in a live project.

---

## Approval vocabulary

`approvals.action_key` remains **text**. Job Operator keys (documented + `STUDIO_JOB_APPROVAL_KEYS`):

| action_key | Intent |
| --- | --- |
| `job_workflow` | Approve production workflow / step plan |
| `job_budget` | Approve quote vs gen+contingency+channel fee |
| `job_rights` | Approve rights / IP concerns from brief analysis |
| `job_delivery` | Approve client delivery |

Campaign keys (`campaign_*`) are unchanged.

---

## Margin helper

```
channel_fee = quote * channel_fee_bps / 10000
expected_gross_margin = quote - channel_fee - estimated_gen * (1 + contingency_bps / 10000)
```

Default contingency is **1000 bps (10%)** on estimated generation spend. Channel fee default is **0** (set per marketplace later).

---

## Explicit non-goals (Phase 0)

- No `/jobs` kanban UI (Phase 1)
- No Higgsfield (or any new media provider) wiring
- No Upwork / Fiverr / Contra scrape, auto-apply, messaging, accept, or delivery automation
- No real brief-analysis LLM yet — `model_used` defaults to `mock`; never claim Astra
- No fake successful media generation
- No Tailwind / shadcn
- Product name stays **F&P Studio**

---

## Phase 1 preview

- `/jobs` board by `studio_job_status`
- Manual intake form → `createStudioJob`
- Surface brief analysis + workflow draft + approval gates
- Link optional campaign; generation still through campaigns (Phase 3)

## Phase 2+ (out of scope here)

- Real brief analysis provider (env stub only)
- Workflow cost estimation from live provider rates
- Optional campaign generation linkage via `studio_job_id`
