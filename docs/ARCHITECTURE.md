# FFS Mission Control Architecture

## Product role
Mission Control is the control plane, not an agent. It owns governance, identity, permissions, execution state, approvals and observability. Agents are workers registered inside this system.

## Non-negotiable invariants
1. No agent receives unrestricted tool access.
2. External side effects are deny-by-default and may require human approval.
3. Every task has a durable state and every consequential action emits an audit event.
4. Provider/model selection is adapter-based. Agent identity is not coupled to a single model vendor.
5. Secrets never enter browser bundles or agent prompts unless explicitly scoped.
6. Mission Control remains usable when an LLM provider is unavailable.

## Phase 1 boundaries
- UI shell and navigation
- Supabase schema for agents, permissions, tasks, approvals and audit events
- Health endpoint
- Deployment configuration for Netlify
- No autonomous agent execution yet
- No external write-capable tools yet

## Phase 2
Authentication/session enforcement, organization membership, server-side data layer, Agent Registry CRUD, immutable audit helpers.

## Phase 3
Task runner interface, provider adapters, execution leases/idempotency, retries and cancellation.

## Phase 4
Approval engine, tool registry and permission evaluation before every tool invocation.

## Phase 5
Memory scopes, workflow orchestration, scheduling, observability, evaluation and cost telemetry.
