# F&P Studio — Phase 0

**Branch:** `fp-studio/phase-0-stabilize-rebrand`  
**Live checkpoint:** https://ffs-mission-control.netlify.app  
**Product name:** F&P Studio (user-facing)  
**Technical identity (unchanged):** GitHub repo `ffs-mission-control`, Netlify site/project name, `package.json` name, health `service` field.

This document maps the current architecture, what Phase 0 reused, and the recommended Phase 1 next steps. It does **not** implement media or generation pipelines.

---

## 1. Phase 0 outcomes

1. Stabilized quality gates: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
2. Rebranded user-facing copy, titles, metadata, and README from Mission Control / FFS Mission Control → **F&P Studio**.
3. Preserved auth, env contract (`.env.example` still only `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`), Netlify build config, and schema.
4. Documented reuse map and Phase 1 recommendations aligned to the rebuild handoff (campaign workspace + asset library + provenance).

---

## 2. Current architecture map

### Stack
- **App:** Next.js 15 App Router + TypeScript + React 19
- **Data / auth:** Supabase SSR (`@supabase/ssr`) + Postgres RLS
- **Deploy:** Netlify (`netlify.toml` → `npm run build`, publish `.next`, Node 20)
- **Tests:** Vitest (domain invariants + migration policy checks)

### Routes
| Path | Role |
| --- | --- |
| `/login` | Public auth form (middleware-excluded) |
| `/api/health` | Public health JSON (middleware-excluded) |
| `/` | Authenticated overview (agent / task / approval counts) |
| `/agents`, `/agents/new`, `/agents/[id]` | Agent registry CRUD UI |
| `/tasks` | Queue tasks (no LLM execution) |
| `/approvals` | Human approval center |
| `/activity` | Append-only audit feed |
| `/settings` | Org + operator identity |

### Middleware
`middleware.ts` requires a Supabase session for all routes except `/api/health`, `/login`, `/auth`, and Next static assets. Missing env redirects to `/login?error=configuration`.

### Server actions & domain
- `lib/actions.ts` — agent create/update/archive, tool permission grants, task create, approval approve/reject/cancel, sign-out
- `lib/auth.ts` — `requireContext()` → user + active org membership
- `lib/audit.ts` — append-only audit writes
- `lib/validation.ts` — FormData parsers
- `lib/domain/*` — task transitions, approval resolution, deny-by-default tool permissions

### Supabase schema (migrations)
**`0001_mission_control_foundation.sql`**
- Enums: `agent_status`, `task_status`, `approval_status`
- Tables: `agents`, `agent_tool_permissions`, `tasks`, `approvals`, `audit_events`
- Temporary broad authenticated RLS (replaced in 0002)

**`0002_governed_registry.sql`**
- `organizations`, `profiles`, `organization_memberships`
- Org-scoped columns + RLS helpers (`is_org_member`, `can_manage_org`)
- Task/approval organization validators, task transition trigger, append-only audit trigger
- Extended statuses: task `draft`/`blocked`, approval `cancelled`

> V1 is single-owner personal studio. Org membership exists for isolation safety, not multi-tenant SaaS.

### Env contract (do not invent new vars in Phase 0)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
Server actions use the signed-in session + RLS. No service role or LLM keys required yet.

---

## 3. What was reused (and kept)

| Existing capability | Studio reuse |
| --- | --- |
| Supabase Auth + SSR middleware | Operator sign-in; protect studio routes |
| Organizations / memberships | Personal studio tenancy boundary (single owner) |
| Agent registry | Future Creative Director / production agents |
| Task console (queued only) | Durable work items before runners exist |
| Approval Center | Human-in-the-loop gates (concept → final master) |
| Audit events | Provenance substrate for mutations |
| Deny-by-default tool permissions | Safety for later write-capable tools |
| Provider fields on agents | Adapter-ready; do not hard-wire one model |
| Netlify deploy | Stable public checkpoint while iterating |
| Industrial UI shell | Preserve visual language; no SaaS marketing rewrite |

**Explicitly not changed in Phase 0:** migrations, auth flow, env vars, package name, Netlify site identity, autonomous execution, media pipelines.

---

## 4. Rebrand choices (Phase 0)

| Surface | Before | After |
| --- | --- | --- |
| Document title / metadata | FFS Mission Control | F&P Studio |
| Sidebar brand | FFS / Mission Control | F&P / Studio |
| Login CTA | Enter Mission Control | Enter F&P Studio |
| README product name | FFS Mission Control | F&P Studio |
| Health JSON | `phase: governed-registry` | `product: F&P Studio`, `phase: phase-0-stabilize-rebrand` |
| Health `service` | `ffs-mission-control` | **unchanged** (technical identity) |
| Repo / Netlify names | ffs-mission-control | **unchanged** |

Internal historical docs (`CODEX_BUILD_BLUEPRINT.md`) remain as control-plane implementation notes; product direction is this file + the rebuild handoff.

---

## 5. Recommended Phase 1 next steps

Align to handoff §5–6 and §21: **Campaign Core** before any Omni / fal.ai / image-video wiring.

### 5.1 Campaign workspace
- Add `campaigns` (and related) tables with org scope + RLS.
- Support entry points: research brief, product URL, uploaded assets, hybrid.
- Folder/structure model mirroring handoff 01–17 (Brief → Exports) as campaign sections, not a greenfield app shell.
- Campaign Intake Agent as a *registered agent purpose* + task type — still no autonomous external writes.

### 5.2 Asset library + uploads
- `assets` table with campaign FK, role enum (`source` | `reference` | `locked` | `generated`), storage path/URL, MIME, and ownership/usage status.
- Upload path via Supabase Storage (or equivalent) behind server actions; no secrets in client.
- Wire UI under a Campaign detail route; keep existing Agents/Tasks/Approvals nav.

### 5.3 Provenance (required before generation volume)
Minimum metadata on assets / research sources:
- source / URL / upload origin
- ownership or usage status
- campaign + asset role
- model/provider (nullable until Phase 2)
- prompt / generation settings (nullable)
- reference asset IDs
- parent revision
- created_at
- approval state
- export lineage (later)

Reuse `audit_events` for mutation trail; do not rely on prompts alone for lineage.

### 5.4 Campaign DNA + Originality Guard (scaffolding)
- Persist Campaign DNA / Brand DNA as structured campaign records (not free-floating chat).
- Originality Guard as locked policy + review checklist hooked to approval gates — convert research observations into original direction; never auto-copy source creative.

### 5.5 Approval enforcement
- Extend approval `action_key` vocabulary for campaign gates (concept, storyboard, assets, editorial, final master, export).
- Enforce at data/service layer (existing `assertApprovalResolution` + RLS patterns), not UI-only.

### 5.6 Explicit non-goals for Phase 1
- No Omni / MiniMax / ChatGPT Image provider integrations yet (Phase 2).
- No timeline NLE, motion, VFX, or render manager.
- No billing, seats, public onboarding, or multi-tenant SaaS features.
- No speculative large schema rewrites unrelated to campaigns/assets/provenance.

---

## 6. Definition of done — Phase 0

- [x] Branch from `main`
- [x] Lint / typecheck / test / build pass
- [x] User-facing F&P Studio rebrand without breaking auth or env contract
- [x] This architecture / reuse / Phase 1 doc
- [ ] PR opened to `main` (requires `gh` auth on the box)

---

## 7. Operator notes

1. Keep https://ffs-mission-control.netlify.app green; ship reversible increments.
2. Prefer docs over speculative migrations until Campaign/Asset models are designed against RLS patterns in `0002`.
3. Final authority: F&P Studio may research, propose, generate, edit, analyze, and prepare — **Wardell remains the final creative decision-maker.**
