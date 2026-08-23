# FFS Mission Control

Private control plane for governed AI agents, tasks, approvals, permissions and execution history.

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

## Phase 1 setup
1. Create a Supabase project and set the two public values from `.env.example`.
2. Apply migrations `0001` then `0002` with the Supabase CLI or SQL editor.
3. Create an organization and active owner membership for the first authenticated user.
4. Run `npm run test`, `npm run lint`, `npm run typecheck`, and `npm run build`.

Phase 1 includes authenticated organization-scoped registry, queued tasks, approvals, and audit history. Autonomous execution and external write-capable tools remain disabled.
