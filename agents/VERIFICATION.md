# VERIFICATION.md

**Use when:** setting up F&P Studio so agents can check their own work, or when
an agent finishes a task with "you can run it and tell me if it works."

That sentence is the symptom. This file is the cure.

House rules live in [`AGENTS.md`](../AGENTS.md). This file is the verification
loop those rules require — how agents close the loop without waiting on Wardell.

---

## Why this is the first thing to build

Without a verification loop, every task ends in a round trip through you. You
become the test suite. With one, the agent closes its own loop and you only see
finished work.

The general test for whether a job is safe to hand to an agent at all:

> **Is the loop verifiable?** Is there a signal, readable by a machine, that
> says this succeeded or failed?

For F&P Studio the critical loop is **campaign → Generate → Assets**. Coding
checks (lint, typecheck, test) are the easy signal; UI proof for Generate and
asset previews needs screenshots once a live URL is available.

---

## What a verification skill actually contains

### 1. A CLI the agents can drive

Not ad-hoc scripts written fresh each time. Those cost tokens, differ between
runs, and cannot be reasoned about.

F&P Studio ships `./verify` at the repo root. Cite it by name in every
instruction that grants autonomy:

```
./verify help              # list commands
./verify check             # lint + typecheck + test (+ build if feasible)
./verify map               # print feature-map.yaml
./verify screenshot assets # proof stub (live URL later)
```

Rules for the CLI:

- deterministic — same input, same result
- exits non-zero on failure, always (`check` especially)
- prints what it did, not just whether it passed
- safe to run repeatedly

### 2. A feature map

Machine-readable description of what the app has and how to get there:
[`feature-map.yaml`](../feature-map.yaml) at the repo root.

Critical flows for this product:

| Flow | Path | Why it matters |
|---|---|---|
| Login / personal bypass | `/login` | Gate for everything; `FP_STUDIO_PERSONAL_BYPASS=true` for local/personal |
| Campaigns list | `/campaigns` | Entry to campaign-first work |
| Campaign detail | `/campaigns/[id]` | Tabs include **Generate** and **Assets** |
| Generate | `?tab=generate` | create job → run → asset registered with preview |
| Assets preview | `?tab=assets` | image/video thumbnail + open full-size |

Agents navigating the studio must follow the map, not guess routes.

### 3. Named invocation

Always cite `./verify` (and this file) when granting autonomy:

> "...using autopilot on F&P Studio. Always rigorously verify with `./verify
> check` and attach proof before merging. Migrations and Netlify deploys stay
> human-gated."

---

## The three rules to enforce

1. **Reproduce before you fix.** Only once the agent can reproduce the bug can
   you trust that it understood the problem. Standing instruction:

   > *"Before writing any code, run the app, find the exact bug and behaviour,
   > and then proceed."*

2. **Proof goes in the PR.** Screenshots or video for UI (Generate / Assets
   previews). Numbers for backend. The reproduction, then the same steps
   passing, for bug fixes. Paste `./verify check` / `./verify map` output.

3. **Verification is the merge gate.** Not a human reading the diff alone —
   but see the caveat below.

The three rules as a form:
[`.github/PULL_REQUEST_TEMPLATE.md`](../.github/PULL_REQUEST_TEMPLATE.md).
Agents fill it in on every PR.

---

## F&P Studio specifics

- **Do not** regenerate Last Sip First stills, change generation providers, or
  touch Netlify as part of a verify pass.
- **Do not** invent browser automation yet — `./verify screenshot` is a stub
  until `LIVE_URL` / `BASE_URL` is set; then it only smoke-checks `/campaigns`.
- Auth: prefer normal login; personal bypass cookie when
  `FP_STUDIO_PERSONAL_BYPASS=true` (see `docs/FP_STUDIO_AUTH.md`).
- App routes of note: `/login`, `/campaigns`, `/campaigns/[id]`, `/agents`,
  `/tasks`, `/approvals`, `/settings`, `/activity`.

---

## The caveat, stated honestly

Auto-merge on green is appropriate in proportion to blast radius.

On a throwaway experiment you can skip reading the diff. On F&P Studio —
campaign DNA, generation jobs, assets, Supabase — read the PR and keep a
**human gate on migrations and deploys** regardless. An autonomous fix with a
bad SQL query mid-stream is how production goes down.

Set the autonomy level from the cost of being wrong, not from how well the loop
has been working lately.

---

## Checklist

- [ ] `./verify check` exits non-zero on failure and prints what ran
- [ ] `./verify map` reflects current F&P Studio routes (especially Generate → Assets)
- [ ] Feature map is current in `feature-map.yaml`
- [ ] Instructions cite `./verify` by name
- [ ] Proof is attached in the PR (template filled)
- [ ] Migrations and deploys still require a human
