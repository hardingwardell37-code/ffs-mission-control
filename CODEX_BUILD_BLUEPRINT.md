# FFS Mission Control — Codex Build Blueprint

You are implementing a production-minded private AI control plane for Forged Field Systems. Do not turn this into a generic AI dashboard. Mission Control governs agents; it is not itself a monolithic agent.

## Current milestone: Foundation → Governed Registry

### Required first pass
1. Inspect every repository file before editing.
2. Run install, typecheck and production build.
3. Preserve the industrial editorial visual language already established. No stock dashboard templates, gradients-for-the-sake-of-gradients, neon AI clichés, generic robot imagery, or placeholder marketing copy.
4. Implement authentication with Supabase SSR and protect all Mission Control routes except `/api/health` and the auth flow.
5. Replace the temporary broad RLS policies with an organization membership model even though V1 is single-owner. Schema must be expansion-safe.
6. Implement Agent Registry CRUD. Required fields: name, slug, purpose, instructions, provider, model, runtime limit, status, tool permissions.
7. Implement Task Console read/create flow but DO NOT execute any LLM call yet. A task may be created and queued only.
8. Implement Approval Center list/detail/resolution data model. No external action is executed yet.
9. Every mutation writes a structured audit event server-side.
10. Add server-side validation and never trust client-provided actor IDs.
11. Add tests for permission decisions, task state transitions and approval resolution invariants.

### Architectural rules
- Use server-side boundaries for secrets and privileged database operations.
- Model providers must be adapter interfaces, not hard-coded calls scattered across UI routes.
- Tool permissions are explicit and deny-by-default.
- Approval requirement is evaluated independently of the UI.
- State transitions must reject invalid transitions.
- Audit records are append-only through the application layer.
- External writes, publishing, messaging, deployment, money movement and destructive operations must later require approval unless a future policy explicitly grants a narrower permission.

### Acceptance gate
Do not declare this milestone complete until:
- typecheck passes
- production build passes
- protected routes reject unauthenticated access
- RLS prevents cross-organization reads/writes
- Agent CRUD works
- queued Task creation works without executing an LLM
- Approval resolution works
- audit records are produced for mutations
- tests cover allowed and forbidden state transitions
- Netlify production configuration contains no secret values

Commit in small, reviewable units. Never overwrite a working subsystem merely to simplify implementation.
