---
name: static-ad-prompt-generator
description: |
  Use when Wardell (or Creative Director) wants a fast 2-phase intake that outputs an F&P Generate-ready photoreal static-ad prompt + negative + settings — for high-end-photoreal-ads and current providers (Runway Gen-4 Image preferred when configured). Adapted from a public X post; not Nano Banana / Gemini JSON.
metadata:
  version: "0.1.0-fp"
  category: creative
  summary: "2-phase intake → F&P Generate prose prompt + negative + settings (DNA/refs lock; no Nano Banana JSON)."
---

# Static ad prompt generator (F&P Studio)

Lean **2-phase intake** that produces an **F&P Generate-ready** package: photoreal commercial **PROMPT** (prose) + **NEGATIVE** + **SETTINGS** + **PACK LOCK** checklist.

**Target craft:** [`../high-end-photoreal-ads/SKILL.md`](../high-end-photoreal-ads/SKILL.md)  
**Originality:** [`../ORIGINALITY.md`](../ORIGINALITY.md) — read before every job  
**Critic** scores before user review ([`../../roster/critic.md`](../../roster/critic.md))

Do **not** emit Nano Banana / Gemini JSON schemas. Do **not** invent providers. Prefer **Runway Gen-4 Image** when that provider is configured; otherwise name only a provider that actually exists in F&P Generate settings.

## Attribution

Adapted from a **public X post** by [@alex_prompter](https://x.com/alex_prompter) — “Static Ads Prompt Generator”  
https://x.com/alex_prompter/status/1996343755981369363  

See [`ATTRIBUTION.md`](ATTRIBUTION.md). Public post; adapted for F&P; **not affiliated**. No Nano Banana workflows vendored.

## When to use

| Ask | Skill |
| --- | --- |
| Quick intake → Generate-ready static ad prompt package | **this skill** |
| Full high-end photoreal craft / mode pick / Critic bar | [`../high-end-photoreal-ads/`](../high-end-photoreal-ads/) |
| General static social / banner without the 2-phase intake | [`../generating-image-ads/`](../generating-image-ads/) |
| AdScoop / Meta Library research → DNA | [`../adscoop-to-fp-handoff/`](../adscoop-to-fp-handoff/) — research-only |

AdScoop refs are **research-only** — never pack identity or Generate locked refs.

## Hard rules

1. Link and obey [`../ORIGINALITY.md`](../ORIGINALITY.md) and [`../high-end-photoreal-ads/SKILL.md`](../high-end-photoreal-ads/SKILL.md).
2. **Product is hero** — primary focal point (~40–50% of frame unless DNA says otherwise); finished ad = headline + hero + CTA.
3. **Specific lighting language** — name key/fill/rim, direction, quality (e.g. “soft key at 45° camera-left, large diffuser, gentle fill −1.5 stops”). **Never** vague “good lighting.”
4. **Plain type for rendered headline / CTA** — exact words from the brief; **NO quotation marks** in the rendered headline string inside the PROMPT.
5. **Never invent a provider.** SETTINGS provider hint = configured F&P provider only (prefer Runway Gen-4 Image when available).
6. **Critic before user review.** No silent regen.
7. **No Nano Banana / Gemini JSON** output. Style library = photography patterns only.

---

## Phase 1 — Context (ONE message)

Ask these **4 questions in a SINGLE message**:

> I'll build your F&P Generate-ready static ad prompt (photoreal commercial). Answer these 4:
>
> **1. PRODUCT & GOAL:** What product/service? What's the ad goal? (e.g. energy drink for late-night creators, Instagram feed engagement)
>
> **2. PLATFORM & ASPECT:** Where will this run + aspect?
> - Instagram feed **1:1** (default) · Stories / Reels **9:16** · Facebook feed **1.91:1** · Pinterest **2:3** · Web / hero **16:9**
> - Aesthetic (pick one): **Luxury / Premium** · **Clean / Minimal** · **Bold / Energetic** · **Lifestyle / Authentic** · **Natural / Organic**
>
> **3. MODEL OR PRODUCT-ONLY:** Human in frame? If yes: age range, gender presentation, action. If no: product-only hero shot.
>
> **4. BRAND INFO:** Brand name, colors (hex if known), Campaign DNA / locked-ref notes, any must-haves or must-nots.

Skip Phase 1 only when DNA + brief already answer all four — then state assumptions and continue.

---

## Phase 2 — Refs & copy (ONE message)

After Phase 1 answers, ask in **ONE message**:

> Perfect. Now I need:
>
> **1. LOGO / PACK REFS:** Point to **locked campaign refs / DNA** (F&P assets). Do **not** require Nano Banana-style uploads — attach locked logo + pack refs when present; describe DNA lockups when refs are missing.
>
> **2. HEADLINE + CTA:** Exact headline and CTA (plain type). These words will render in the ad — **no quotation marks** around the headline in the final frame.
>
> **3. PRODUCT APPEARANCE LOCK:** Confirm pack / product look from DNA (silhouette, colorway, label, materials, condensation, etc.). List only invariants DNA specifies.
>
> **4. MODE (optional):** Prefer a [`high-end-photoreal-ads`](../high-end-photoreal-ads/SKILL.md) mode — `editorial-fashion` · `branded-series-frame` · `luxury-end-card` · `product-system-frame` — or leave for craft default.

Then generate the output package immediately (no third intake round unless copy is missing).

---

## Style library (photography patterns — not JSON)

Map Phase 1 aesthetic → lighting / lens / set language for the prose PROMPT:

| Style | Photography pattern |
| --- | --- |
| **Luxury / Premium** | Soft directional key, controlled speculars on glass/metal, shallow DOF, limited palette, negative space, elegant serif or quiet sans for type |
| **Clean / Minimal** | Even softbox or north-light feel, seamless or near-seamless ground, generous margins, bold sans, one accent for CTA |
| **Bold / Energetic** | Harder key + color gel or saturated field, punchy contrast, dynamic angle, heavy display sans, solid CTA pill/bar |
| **Lifestyle / Authentic** | Natural window or golden-hour side light, lived-in set, shallow DOF, candid posture, type in clean negative space |
| **Natural / Organic** | Diffused daylight, earth materials (stone, wood, linen), soft contact shadows, muted grade, restrained type |

Always name **one primary light** + material cues (aluminum micro-scratch, cold condensation, printed label ink) — not “premium look” alone.

---

## Output format (F&P Generate-ready)

Emit exactly these blocks:

### PROMPT

Prose paragraph(s) for photoreal commercial / editorial still:

1. Preservation / DNA lock (product + label unchanged when refs attached).
2. Scene + composition (product hero; mode layout from high-end-photoreal-ads).
3. Exact headline + CTA as **plain type** (no quote marks wrapping the headline).
4. Specific lighting + camera/DOF when useful.
5. Safe margins for platform aspect.

### NEGATIVE

Include at least: cartoon, illustration, anime, CGI plastic, blank unlabeled packs, melted/warped typography, quotation marks around headline, stock HDR glow, competitor trademarks / Coke cues, cluttered equal-weight collage, missing CTA, Nano Banana / UI chrome artifacts.

### SETTINGS

| Field | Guidance |
| --- | --- |
| **aspect** | From Phase 1; default **1:1** |
| **provider hint** | Prefer **Runway Gen-4 Image** when configured; else only a real F&P Generate provider — **never invent** |
| **mode** | One of `editorial-fashion` · `branded-series-frame` · `luxury-end-card` · `product-system-frame` (from high-end-photoreal-ads) |

### PACK LOCK checklist

DNA-driven. Check only what Campaign DNA / locked refs specify — **do not** invent charcoal, vertical stripe, or other pack cues unless DNA says so.

Example shape (fill from DNA):

- [ ] Silhouette / can geometry matches locked ref  
- [ ] Colorway / finish (e.g. charcoal matte — **only if DNA**)  
- [ ] Label / stripe / lockup (e.g. vertical stripe — **only if DNA**)  
- [ ] Logo placement per DNA / series lock  
- [ ] No blank pack; no competitor trade dress  

If DNA is silent on a cue, write `n/a (not in DNA)` rather than guessing.

---

## After output

1. Hand package to **F&P Generate** (attach locked refs).
2. **Register** result as a campaign asset.
3. **Critic** scores (photoreal, labeled packs, lighting specificity, originality, prompt fidelity) → then user review.

## Common mistakes

- Emitting Nano Banana / Gemini JSON instead of prose + negative + settings  
- Requiring user “uploads” instead of locked campaign refs / DNA  
- Quotation marks in the rendered headline  
- Vague “good lighting”  
- Inventing Runway (or any provider) when not configured — or inventing pack cues not in DNA  
- Skipping Critic / ORIGINALITY  
- Treating AdScoop stills as Generate refs  

## Related

- [`ATTRIBUTION.md`](ATTRIBUTION.md)  
- [`../ORIGINALITY.md`](../ORIGINALITY.md)  
- [`../high-end-photoreal-ads/SKILL.md`](../high-end-photoreal-ads/SKILL.md)  
- [`../generating-image-ads/SKILL.md`](../generating-image-ads/SKILL.md)  
- [`../adscoop-to-fp-handoff/SKILL.md`](../adscoop-to-fp-handoff/SKILL.md)  
