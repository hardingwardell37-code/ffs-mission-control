---
name: generating-image-ads
description: |
  ALWAYS read this skill before F&P campaign Generate / static ad / social ad / banner asks. Turns Campaign DNA + locked product refs into finished static image ads — one frame or a ratio set — holding pack identity identical. Triggers: F&P Generate static ads, "image ad", "static ad", "promo graphic", "social ad", "banner ad", "ad creative". Not for packshots alone (generating-product-photos) or commercials (generating-ad-videos).
license: Apache-2.0
metadata:
  version: "0.1.0-fp"
  category: creative
  summary: "F&P Studio adaptation: scroll-stopping static ads via Generate jobs — single-minded proposition, designed layout, original DNA-grounded packs, consistent across ratios."
  adapted_from: "SupercmoHQ/superCMO-skills generating-image-ads (Apache-2.0)"
---

# Image ads (F&P Studio)

Turn campaign product DNA into finished static ad(s) via **F&P Generate** jobs.

## Originality guard

**Read [`../ORIGINALITY.md`](../ORIGINALITY.md) before every job.** Never Coke / competitor trademarks, ribbons, slogans, logos, polar bears, or copied ad frames. **ALWAYS** invent original fictional brand/pack labels grounded in Campaign DNA. **Blank unlabeled cans = FAIL.** Photoreal product in a designed layout — not cartoon/CGI plastic. Lead Research owns DNA; Creative Director explores; Critic scores before user review.

## Tool mapping (F&P)

Do **not** call SuperCMO’s private `image_generate` MCP.

1. Write **provider-ready prompt + negative prompt + settings** for F&P Generate.
2. Attach locked product / logo refs when present.
3. **Register** results as campaign assets.
4. Critic scores → user review.

## Workflow

### Step 1: Read what you have

- Campaign DNA + locked refs → product facts, use mechanic, invariants (including **original label**).
- Look at refs before describing. Don’t invent from competitor ads.
- No product/DNA → ask before generating; don’t ad-make a blank can.

### Step 2: Interview

Skip when the brief already makes the ad obvious. Otherwise ask once:

| Ask | When |
| --- | --- |
| Product / DNA | No image and no DNA |
| Brand guidelines from DNA | None in brief |
| **The offer and the one claim** | Ad must say something; **only user/DNA-supplied claims** |
| Placement and ratios | Destination decides crop / safe zones |

When waived: single `1:1`, product-hero direction, one benefit-led line from DNA — state settings and continue.

### Step 3: Find the idea

Read `references/ad-craft.md`. Single-minded proposition: one tension between consumer truth and product truth → one sentence idea → treatment. For a set, each ad needs a **different insight**, not a costume change on the same insight.

### Step 4: Write the copy

Copy last — only what the picture leaves unsaid. From supplied claims only:

- **Headline** — always
- **Support** — optional
- **CTA** — optional 2–4 words as a **button** (filled shape, accent colour)

Never invent statistics, ratings, or badges.

### Step 5: Write the product description

One description, reused unchanged. With refs: angle/state/action only. Without: form, closure, materials, action. Preserve DNA label via refs; don’t transcribe every printed character into the prompt (warps).

### Step 6: Design the ad

Hold to `references/ad-craft.md`: one focal point, figure/ground, copy in negative space, type/colour discipline, grid, safe zones.

Decide: how many; ratio family (default single `1:1` if unnamed); layout.

### Step 7: Provider settings

| Need | Guidance |
| --- | --- |
| Text-forward designed layout | Text-strong provider/settings; quote every string |
| Photoreal product-led, light text | Narrative paragraph; quote drawn copy |
| Prior refusal | Tighten negatives; originality-safe stand-ins |

### Step 8: Show the concept and wait

Nothing expensive until approval (unless user waived asks). Show direction, copy word-for-word, layout/ratios. Expect edits.

### Step 9: Generate (F&P Generate)

- One job object per deliverable (per ratio / variant).
- Prompt, negative prompt, aspect ratio, resolution, reference asset IDs.
- Locked product refs every time when present.
- Don’t silent-regen or self-vision-score.
- Poll pending; never double-submit.

### Step 10: Return

Register assets; present the set in outlined order; Critic before user review.

## Common mistakes

- Invented claims / badges
- Copy across the product’s focal area
- More than one message
- CTA under platform chrome
- Competitor names in the prompt
- Blank packs / Coke-like trade dress

## Edge cases

- No product → stop and ask
- Warped text → deliver, note, suggest quote-exact + higher res + text-strong settings; wait for ask to regen
- One ratio fails → resubmit only that deliverable
- Plain packshot with no ad message → `generating-product-photos`
- Video → `generating-ad-videos`

## Reference

- `references/ad-craft.md`
- [`../ORIGINALITY.md`](../ORIGINALITY.md)
- High-end F&P quality bar / style lock → [`../high-end-photoreal-ads/`](../high-end-photoreal-ads/)
