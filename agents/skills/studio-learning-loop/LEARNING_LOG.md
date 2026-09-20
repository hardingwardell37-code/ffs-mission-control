# F&P Studio learning log

Append-only. Newest entries at the **top**. Read before Generate. See [`SKILL.md`](SKILL.md).

---

### 2026-09-20 — Northline Travel Plaza — KEEPER
- **Verdict:** Critic Pass · Wardell pending (Critic keeper)
- **Pipeline:** high-end-photoreal-ads (`cinematic-outdoor-hero`) + benefit-led DNA · PE green-light · Runway `gpt_image_2` · `1920:1920` · ONE render
- **What worked:**
  - Benefits of stopping verified from real plaza sites (Pilot, Love’s, TA) then rewritten for fictional Northline — no guessing
  - Benefit bar in-frame: Hot shower. Fresh food. Full tank.
  - Headline plain (no quote marks): Stop once. Leave ready. + boxed CTA
  - Blue-hour exterior + warm canopy practicals; finished ad structure not a bare plaza photo
  - Competitor IP named in negatives (Pilot / Love’s / TA / Buc-ee’s)
- **What failed / why:** n/a
- **Carry forward:** Service ads must show traveler benefits in the frame; research real category sites first; keep fictional brand lock.

### 2026-09-20 — Marella Soft (Barrier Night Cream) — KEEPER
- **Verdict:** Critic Pass · Wardell keeper (“beautiful ad”)
- **Pipeline:** high-end-photoreal-ads (editorial) + static-ad-prompt-generator · PE lock · Runway `gpt_image_2` · `1920:1920` · ONE render
- **What worked:**
  - Finished editorial beauty ad (headline + pack + CTA), not a packshot
  - Pack lock: frosted jar, sage lid, MARELLA / SOFT / BARRIER NIGHT CREAM legible
  - Plain headline (no quotation marks); sage pill CTA
  - PE shortened/structured prompt before credit; default model `gpt_image_2` after PR #18
  - Lean single pass → Critic → keeper
- **What failed / why:** n/a (earlier Gen-4 prompt over UTF-16 1000 limit blocked a prior attempt — see fail entry)
- **Carry forward:** Ads not packshots; PE green-light before spend; `gpt_image_2` default for stills; one render unless redo.

### 2026-09-20 — Runway Gen-4 prompt over limit — FAIL (pre-credit / blocked)
- **Verdict:** Provider validation error — no usable frame
- **Pipeline:** Runway Gen-4 family · promptText exceeded **1000 UTF-16** code units
- **What worked:** Catching the error led to PE role + prompt gate in provider
- **What failed / why:** Unchecked long editorial prompt; Gen-4/muse hard limit 1000 UTF-16 (gpt_image_2 allows up to 32000)
- **Carry forward:** PE measures UTF-16 vs model limit before Generate; provider fails clearly (no silent truncate).

### 2026-09-20 — Last Sip First early stills — FAIL / REDO
- **Verdict:** Wardell rejected (cartoonish; blank cans; later: packshots not ads)
- **Pipeline:** Pre–high-end skill lock; multi-frame temptation
- **What worked:** Forced originality + photoreal skill adoption; cut to one hero to save credits
- **What failed / why:**
  - Cartoon / non-photoreal look
  - Blank unlabeled packs (ORIGINALITY fail)
  - Generated packshots when brief needed finished ads (headline + CTA + benefits)
  - Credit risk from multiple variants without a keeper
- **Carry forward:** Photoreal + labeled fictional packs only; finished ad structure; benefits in copy; one lean render; Critic before user.

### Standing pipeline (do not regress)
1. Research/DNA + ORIGINALITY guards  
2. Craft skills (high-end-photoreal-ads / generating-image-ads / static-ad-prompt-generator)  
3. Prompt Engineer structure + green-light  
4. Runway stills default **`gpt_image_2`**, 1:1 → **`1920:1920`**, **ONE** render  
5. Critic → Wardell keeper/redo  
6. **Append this log**
