# F&P Studio Architecture

> Product name: **F&P Studio**. Technical repo and Netlify site remain `ffs-mission-control`.

## Product role
F&P Studio is Wardell’s personal AI commercial production studio and campaign operating system. The current codebase is the governance control plane (agents, tasks, approvals, audit). Agents are workers registered inside this system. Campaign workspace, asset library, and media pipelines are planned incremental phases — see `docs/FP_STUDIO_PHASE0.md`.

## Non-negotiable invariants
1. No agent receives unrestricted tool access.
2. External side effects are deny-by-default and may require human approval.
3. Every task has a durable state and every consequential action emits an audit event.
4. Provider/model selection is adapter-based. Agent identity is not coupled to a single model vendor.
5. Secrets never enter browser bundles or agent prompts unless explicitly scoped.
6. The studio remains usable when an LLM provider is unavailable.
7. Wardell retains final creative authority at every major production gate.

## Current foundation (reused)
- UI shell and navigation
- Supabase schema for organizations, memberships, agents, permissions, tasks, approvals and audit events
- Supabase SSR authentication and route protection
- Health endpoint
- Deployment configuration for Netlify
- No autonomous agent execution yet
- No external write-capable tools yet
- No campaign / asset / media tables yet

## Rebuild phases (product handoff)
| Phase | Scope |
| --- | --- |
| 0 — Stabilize | Audit, branch, rebrand, document reuse (this PR) |
| 1 — Campaign Core | Campaign workspace, asset library, uploads, provenance, Campaign DNA, intake, research URLs, Originality Guard |
| 2 — Generation | Image/video provider interfaces, Omni, fal.ai MiniMax, jobs, locks, metadata |
| 3 — Creative Planning | Creative Director, Casting, Editorial Image Director, storyboard/previs, approval gates |
| 4 — Editor | Timeline, Senior Editor Agent, EDL review, approval before finishing |
| 5 — Motion/VFX/Audio/Color | Post capabilities, HyperFrames evaluation |
| 6 — QC & Delivery | Frame/audio QC, preflight, render/export |
| 7 — Learning System | Skill registry, preference learning, studio knowledge |

## Historical control-plane milestones
Earlier Mission Control milestones (registry, tasks, approvals) remain the substrate. Do not greenfield-rewrite them.
