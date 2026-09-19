# F&P Studio

Personal AI commercial production studio and campaign operating system for Wardell Harding.

> **Repo / deploy identity (unchanged):** GitHub `ffs-mission-control`, Netlify site `ffs-mission-control.netlify.app`. Product-facing name is **F&P Studio**.

## Product direction
F&P Studio evolves the existing Mission Control foundation into a campaign-first production environment: research → Campaign DNA → concept → generation → editorial → finishing → QC → Wardell approval → export. AI handles production labor; Wardell retains creative authority and final approval.

This is a **personal production studio**, not a multi-tenant SaaS product. No billing, seats, or public onboarding.

## Stack
- Next.js + TypeScript
- Supabase/Postgres
- Netlify
- GitHub source control
- Provider adapters added in later milestones

## Local start
```bash
cp .env.example .env.local
npm install
npm run dev
```

## Phase status
- **Phase 0** — stabilize + F&P Studio rebrand. See `docs/FP_STUDIO_PHASE0.md`.
- **Phase 1** — Campaign Core: campaigns, DNA, research/Originality Guard fields, assets + provenance, optional `campaign-assets` Storage bucket. See `docs/FP_STUDIO_PHASE1.md`.
- **Phase 2** — Generation: jobs, provider router (Grok Imagine / OpenAI Image / Google Omni / fal MiniMax H3), Generate tab. See `docs/FP_STUDIO_PHASE2.md`.
- Auth — sign-in, signup, forgot password, membership bootstrap (`0004`), temporary personal bypass. See `docs/FP_STUDIO_AUTH.md`.

## Setup
1. Create a Supabase project and set values from `.env.example`.
2. Apply migrations `0001`, `0002`, `0003_campaign_core.sql`, `0004_studio_bootstrap.sql`, then `0005_generation_jobs.sql` (SQL editor or CLI).
3. Sign up / sign in on `/login` — `ensure_studio_access` creates the personal org + owner membership (or use temporary personal bypass).
4. (Optional) Create Storage bucket `campaign-assets` for file uploads — see Phase 1 doc.
5. (Optional) Set provider keys `XAI_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_OMNI_API_KEY`, and/or `FAL_KEY` for real generation — see Phase 2 doc.
6. Optional: enable temporary personal bypass with `FP_STUDIO_PERSONAL_BYPASS=true` + `SUPABASE_SERVICE_ROLE_KEY`.
7. Run `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

Existing foundation includes authenticated organization-scoped registry, campaigns/assets, generation job scaffolding, queued tasks, approvals, and audit history. Autonomous execution remains disabled; providers only run when keys are present.
