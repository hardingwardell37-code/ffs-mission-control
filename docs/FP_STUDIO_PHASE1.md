# F&P Studio — Phase 1 (Campaign Core)

**Branch:** `fp-studio/phase-1-campaign-assets`  
**Live checkpoint:** https://ffs-mission-control.netlify.app  
**Product name:** F&P Studio  
**Technical identity:** `ffs-mission-control` (repo, Netlify, health `service`)

Phase 1 builds **Campaign Core** before any generation providers (Omni / fal / MiniMax / image models).

---

## 1. What shipped

1. **Schema** `supabase/migrations/0003_campaign_core.sql`
   - `campaigns` — org-scoped, entry modes (`research` | `product_url` | `upload` | `hybrid`), brief, product URL, status
   - `campaign_dna` — positioning, audience, tone, visual direction, do-not-copy notes, originality policy
   - `campaign_sections` — seeded 01–17 folder keys (Brief → Exports) via insert trigger
   - `research_sources` — URL + observation + **original direction** (Originality Guard scaffolding)
   - `assets` — role, ownership, storage path/URL, provenance fields (origin, parent, model/prompt nullable, references array, approval state)
   - RLS via existing `is_org_member` / `can_manage_org`
2. **Server actions** — create/list/get campaigns; update brief/DNA; add research; register asset metadata (+ optional Storage upload)
3. **UI** — `/campaigns`, `/campaigns/[id]` tabs (Overview / DNA / Research / Assets); sidebar **Campaigns**
4. **Health** — `phase: phase-1-campaign-core` (service + product unchanged)
5. **Approval vocabulary** (documented / domain constants; `approvals.action_key` stays text):
   - `campaign_concept`, `campaign_storyboard`, `campaign_assets`, `campaign_editorial`, `campaign_final_master`, `campaign_export`

---

## 2. Apply migration `0003`

After `0001` and `0002`:

```bash
# Supabase CLI (from repo root)
supabase db push
# or paste 0003_campaign_core.sql into the SQL editor
```

Confirm tables exist: `campaigns`, `campaign_dna`, `campaign_sections`, `research_sources`, `assets`.

---

## 3. Storage bucket setup (manual)

Uploads target bucket name **`campaign-assets`**. No new env vars — uses existing:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Dashboard steps (Wardell)

1. Supabase → **Storage** → **New bucket** → name `campaign-assets` (prefer **private**).
2. Add policies so authenticated users can upload/read under `{organization_id}/{campaign_id}/…` (match your RLS posture). Example intent:
   - authenticated insert/select on objects in `campaign-assets` for active members.
3. Optional: leave public URLs disabled; the UI still stores `storage_path` and will fill `storage_url` when `getPublicUrl` is available. Signed URLs can be added later without schema change.

If the bucket is missing, the asset form **still registers metadata** with the intended path and shows a clear message — production use requires the bucket.

Signed-path contract stored on `assets`:

| Column | Meaning |
| --- | --- |
| `storage_path` | Object key in `campaign-assets` |
| `storage_url` | Public or signed URL when available |
| `origin` | `upload` \| `url` \| `generated` \| `import` |
| `source_url` | External origin when not an upload |
| `ownership_status` | `owned` \| `licensed` \| `generated` \| `unknown` |
| `role` | `source` \| `reference` \| `locked` \| `generated` |

---

## 4. Routes added

| Path | Role |
| --- | --- |
| `/campaigns` | List + create |
| `/campaigns/[id]?tab=overview\|dna\|research\|assets` | Campaign workspace |

Existing Agents / Tasks / Approvals / Activity / Settings unchanged.

---

## 5. Explicit non-goals (still deferred)

- No Omni / MiniMax / ChatGPT Image / fal integrations (Phase 2)
- No timeline NLE, motion, VFX, render
- No billing, seats, public onboarding
- No Look Bible / dailies surfaces

---

## 6. Phase 2 next steps

1. Provider/capability interfaces (do not hard-wire model names in campaign logic).
2. Generation jobs table + nullable model/prompt fields already on `assets`.
3. Image + video routers; write results as `role=generated` with full provenance.
4. Wire approval gates (`campaign_concept`, `campaign_assets`, …) into task/approval creation.
5. Asset locks / reference_asset_ids enforcement at generation time.

---

## 7. Definition of done — Phase 1

- [x] Migration `0003` with org RLS
- [x] Campaign CRUD + DNA + research + asset metadata UI
- [x] Storage contract documented; upload works when bucket exists
- [x] Health phase bump
- [x] Lint / typecheck / test / build
- [ ] PR to `main`
