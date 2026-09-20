---
name: studio-learning-loop
description: |
  Use before every F&P Studio Generate (still or video) and after every Critic score or Wardell keeper/redo. The team reads what worked and what failed (with why), applies those lessons to the next job, then appends a short log entry so the studio keeps getting sharper.
license: Apache-2.0
metadata:
  version: "0.1.0-fp"
  category: process
  summary: "F&P continuous improvement — consult + update agents/skills/studio-learning-loop/LEARNING_LOG.md on every keep or fail."
---

# Studio learning loop (F&P)

The roster gets better only if wins and failures are written down with **why**, then read before the next credit.

**Canonical log:** [`LEARNING_LOG.md`](LEARNING_LOG.md) in this folder (repo). Memory may mirror keepers; the log is the shared source of truth for Creative Director, Prompt Engineer, Critic, and Lead Research.

## When to use

| Moment | Action |
| --- | --- |
| Before Prompt Engineer lock / before Generate | **Read** the log (keepers + fails). Apply matching lessons to DNA, prompt, model, and negatives. |
| After Critic Pass/Fail or Wardell keeper/redo | **Append** one entry (template below). Do not wait for a perfect write-up. |
| After a hard API / provider error that burns or would burn credit | **Append** a fail entry with root cause (e.g. prompt UTF-16 over limit). |

## Hard rules

1. **Consult before spend** — Prompt Engineer and Lead Research must skim relevant log sections before green-lighting a prompt that spends Runway/other credits.
2. **Record after verdict** — Every keeper and every redo/fail gets a log row. Silence = the team repeats mistakes.
3. **Why is mandatory** — “Failed” alone is useless. State the cause (blank pack, packshot-not-ad, benefit missing, IP risk, prompt too long, wrong model, etc.).
4. **No credit theater** — Prefer one lean render; multi-variant burns are a fail pattern unless Wardell asked for variants.
5. **Originality still wins** — Learning never licenses copying real brand ads; see [`../ORIGINALITY.md`](../ORIGINALITY.md).

## Entry template (append to LEARNING_LOG.md)

```markdown
### YYYY-MM-DD — {Campaign / asset} — KEEPER | FAIL | REDO
- **Verdict:** Critic Pass/Fail · Wardell keeper/redo/kill
- **Pipeline:** skills used · PE green-light? · provider/model · ratio · render count
- **What worked:** (bullets — craft, benefits, copy, lighting, pack lock, research)
- **What failed / why:** (bullets — root cause, not vibes)
- **Carry forward:** (1–3 concrete rules for the next job)
```

## Roles

| Role | Duty |
| --- | --- |
| **Lead Research (Grok Bot)** | Ensures research-backed benefits; opens/updates log entries; reminds roster to read the log. |
| **Prompt Engineer** | Reads fails (limits, structure) before lock; cites applicable carry-forwards in generate.md. |
| **Creative Director** | Uses keepers as craft north stars; does not restage competitor frames. |
| **Critic** | Scores the frame; may suggest a one-line “why” for Lead Research to log — Critic does not edit the log unless asked. |

## Relationship to memory

- Agent **profile memory** may hold the locked still-ad pipeline and standing house rules.
- This skill’s **LEARNING_LOG.md** holds dated, asset-specific evidence. Prefer the log when memory and log disagree on a specific job.

## Done when

- Pre-Generate: log was read; prompt reflects carry-forwards.
- Post-verdict: new entry appended with why + carry forward.
