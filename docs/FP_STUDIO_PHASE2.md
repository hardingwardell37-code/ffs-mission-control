# F&P Studio — Phase 2 (Generation)

**Branch:** `fp-studio/phase-2-generation`  
**Live checkpoint:** https://ffs-mission-control.netlify.app  
**Product name:** F&P Studio  
**Technical identity:** `ffs-mission-control` (repo, Netlify, health `service`)

Phase 2 adds **generation jobs**, a **provider interface layer**, and scaffolding for **Grok Imagine** (xAI), OpenAI Image, Google Omni, and fal.ai MiniMax H3 / H3 Max. Real API calls run only when server keys are present; missing keys return clear `not_configured` failures (never fake successes).

This remains a **personal studio** — not multi-tenant SaaS. No billing.

---

## 1. What shipped

1. **Schema** `supabase/migrations/0005_generation_jobs.sql`
   - Enums: `generation_provider` (includes `grok_imagine`), `generation_modality`, `generation_job_status`
   - `generation_jobs` — org + campaign scoped; prompt / negative / settings; reference + locked asset id arrays; result asset link; cost / external id / timestamps
   - `generation_job_events` — status trail (trigger on insert/status change)
   - Trigger enforces reference / locked / result assets belong to the **same campaign + org**
   - RLS via existing `is_org_member` / `can_manage_org`
   - Indexes on `(campaign_id, status)` and org / active-status helpers
2. **Provider layer** `lib/generation/`
   - `types.ts` — `JobRequest` / `JobResult` / `GenerationProvider`
   - `router.ts` — Auto selection by modality + env availability
   - `providers/grok-imagine.ts` — image + video via xAI Imagine API (`XAI_API_KEY`)
   - `providers/openai-image.ts`, `google-omni.ts`, `fal-minimax.ts`
3. **Server actions** — `createGenerationJob`, `runGenerationJob`, `cancelGenerationJob` (list via campaign page query)
4. **UI** — Campaign **Generate** tab: modality, provider (incl Auto + Grok Imagine), prompt, negative, references, locks, job list
5. **Health** — `phase: phase-2-generation` (service + product unchanged)
6. **Originality** — UI copy + light prompt guard against “exact copy of this ad” style asks

---

## 2. Apply migration `0005`

After `0001`–`0004` (as applicable):

```bash
# Supabase CLI (from repo root)
supabase db push
# or paste 0005_generation_jobs.sql into the SQL editor
```

Confirm tables: `generation_jobs`, `generation_job_events`. Confirm enums include `openai_image`, `google_omni`, `fal_minimax_h3`, `fal_minimax_h3_max`, `grok_imagine`, `auto`.

---

## 3. Environment keys (optional, server-only)

Never put these in client bundles. Set on Netlify → Site settings → Environment variables (and locally in `.env.local`):

| Variable | Provider |
| --- | --- |
| `XAI_API_KEY` | Grok Imagine (image + video) |
| `OPENAI_API_KEY` | OpenAI Image |
| `GOOGLE_OMNI_API_KEY` | Google Omni (preferred) |
| `GOOGLE_API_KEY` / `GEMINI_API_KEY` | Accepted fallbacks for Omni scaffolding |
| `FAL_KEY` | fal MiniMax H3 / H3 Max |

Without keys, creating a job and running it **fails with `not_configured`** — intentional.

---

## 4. Auto router rules

| Modality | Preference order |
| --- | --- |
| `image` | Grok Imagine → OpenAI Image → Google Omni |
| `video` | fal MiniMax H3 → Grok Imagine → Google Omni |

Explicit provider selection still requires that provider’s key.

- **Grok Imagine** image → `POST https://api.x.ai/v1/images/generations` (default model `grok-imagine-image`)
- **Grok Imagine** video → `POST https://api.x.ai/v1/videos/generations` + poll (default model `grok-imagine-video`)
- H3 maps to fal `hailuo-2.3/standard/text-to-video`; H3 Max → `…/pro/text-to-video`

---

## 5. Routes / surfaces

| Path | Role |
| --- | --- |
| `/campaigns/[id]?tab=generate` | Generation form + job list |

Successful runs insert an `assets` row with `role=generated`, provenance (`model_provider`, `model_name`, `prompt`, `reference_asset_ids`), and link `generation_jobs.result_asset_id`.

---

## 6. Explicit non-goals (deferred)

- No Premiere / NLE / timeline (Phase 4+)
- No motion / VFX pipeline
- No autonomous skip of approval gates
- No billing
- Binary upload of provider bytes into Storage can deepen in 2.1; URL results are linked now

---

## 7. Phase 3 next steps

1. Wire approval gates (`campaign_concept`, `campaign_assets`, …) into task/approval creation on generation milestones.
2. Stronger lock enforcement at generation time (prompt injection / hard constraints).
3. Webhook / async completion for long fal / Grok video jobs.
4. Look Bible / dailies surfaces; deeper Omni video when API is ready.

---

## 8. Definition of done — Phase 2

- [x] Migration `0005` with org RLS + same-campaign asset checks
- [x] Provider interfaces + Auto router (incl Grok Imagine) + missing-key failures
- [x] Create / run / cancel jobs + generated asset provenance
- [x] Generate tab UI with Grok Imagine selectable
- [x] Health phase bump + docs + `.env.example`
- [x] Lint / typecheck / test / build
