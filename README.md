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

## Phase 0 (this branch)
Stabilize lint/typecheck/test/build, rebrand user-facing copy to F&P Studio, and document architecture reuse for Phase 1. See `docs/FP_STUDIO_PHASE0.md`.

## Setup
1. Create a Supabase project and set the two public values from `.env.example`.
2. Apply migrations `0001` then `0002` with the Supabase CLI or SQL editor.
3. Create an organization and active owner membership for the first authenticated user.
4. Run `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

Existing foundation includes authenticated organization-scoped registry, queued tasks, approvals, and audit history. Autonomous execution and external write-capable tools remain disabled.
