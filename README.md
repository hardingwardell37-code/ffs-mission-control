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

See `docs/FP_STUDIO_AUTH.md` for sign-in, signup, membership bootstrap (`0004`), and the temporary personal bypass.

## Setup
1. Create a Supabase project and set values from `.env.example`.
2. Apply migrations `0001`, `0002`, then `0004_studio_bootstrap.sql` (SQL editor or CLI).
3. Sign up / sign in on `/login` — `ensure_studio_access` creates the personal org + owner membership.
4. Optional: enable temporary personal bypass with `FP_STUDIO_PERSONAL_BYPASS=true` + `SUPABASE_SERVICE_ROLE_KEY`.
5. Run `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

Existing foundation includes authenticated organization-scoped registry, queued tasks, approvals, and audit history. Autonomous execution and external write-capable tools remain disabled.
