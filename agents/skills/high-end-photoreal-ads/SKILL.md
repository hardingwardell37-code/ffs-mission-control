---
name: high-end-photoreal-ads
description: |
  Use when Wardell wants high-end photoreal static ads at the F&P quality bar / style lock — editorial fashion frames, branded series, luxury end cards, product-system grids, or cinematic outdoor heroes. Ground layout and photography ONLY in references/examples/. Not for bare packshots (generating-product-photos). Keep generating-image-ads as the general static-ad skill; this skill raises the craft bar.
license: Apache-2.0
metadata:
  version: "0.1.0-fp"
  category: creative
  summary: "F&P Studio style lock: photoreal finished ads (headline + hero + CTA) via Generate — modes from locked example refs."
---

# High-end photoreal ads (F&P Studio)

Style lock for finished static ads that read as high-end commercial / editorial photography — not packshots alone, not cartoon/CGI plastic.

**Ground craft ONLY in** [`references/examples/`](references/examples/) and the distilled rules in [`references/craft.md`](references/craft.md). Do not invent agency attributions for those files. Do not claim they are any particular studio’s portfolio.

## Originality guard

**Read [`../ORIGINALITY.md`](../ORIGINALITY.md) before every job.** Never Coke / competitor trademarks, ribbons, slogans, logos, polar bears, or copied ad frames. **ALWAYS** invent original fictional brand/pack labels grounded in Campaign DNA. **Blank unlabeled cans = FAIL.** Photoreal product / people / materials — real light, skin, glass, metal — not cartoon or CGI plastic. Lead Research owns DNA; Creative Director explores; Critic scores before user review.

## When to use

| Ask | Skill |
| --- | --- |
| High-end photoreal finished ad / series / end card / product system | **this skill** |
| General static social / banner / offer ad | [`../generating-image-ads/`](../generating-image-ads/) |
| Packshot / hero / lifestyle still with **no** ad message | [`../generating-product-photos/`](../generating-product-photos/) |
| Moving commercial | [`../generating-ad-videos/`](../generating-ad-videos/) |

## Hard requirements (FAIL if missed)

1. **Photoreal photography language** — real light, materials, skin, glass, metal; contact shadow; lens depth. **FAIL** cartoon, illustration, anime, or CGI plastic.
2. **Finished AD structure** — single-minded **headline** + **product/hero** + **CTA** (button/pill or solid bar). **Not** a bare packshot.
3. **True aspect** the brief asks for (default **1:1** feed unless told). Keep key type and CTA inside **safe margins**.
4. **Pack / product identity lock** from Campaign DNA + locked refs when present — same silhouette, colorway, label; never blank packs.
5. **Critic bar** before user review (see below).

## Modes (selectable from examples)

Pick one mode that matches the brief; cite the matching example file:

| Mode | Example | Pattern |
| --- | --- | --- |
| `editorial-fashion` | `01-editorial-fashion.jpg` | Large brand/display type behind or beside subject; grid; solid CTA; limited/monochrome palette; editorial fashion photography |
| `branded-series-frame` | `02-branded-series.jpg` | Multi-up series; thick brand-color field/border; consistent logo + footer CTA; photoreal people; speech-bubble / graphic overlays |
| `luxury-end-card` | `03-luxury-product-storyboard.png` | Luxury product film board → static **end card** with short tagline; reflective glass/metal; 9:16 panels when briefed |
| `product-system-frame` | `04-wellness-product-system.jpg` | Multi-frame product system; pack color matches environment; footer lock (logo + tagline + URL); lifestyle + hero + family |
| `cinematic-outdoor-hero` | `05-cinematic-outdoor-hero.jpg` | Three-quarter product in environment; wet/reflective ground; blue-hour + warm practicals; small product line → large serif/display headline in negative space → feature bar → boxed CTA + URL; product owns frame |

Full index: [`references/EXAMPLE_INDEX.md`](references/EXAMPLE_INDEX.md).

## Tool mapping (F&P)

Do **not** call SuperCMO MCP (`image_generate` / private tools).

1. Read Campaign DNA + locked product / logo refs.
2. Choose mode + open the matching example; distill layout from `craft.md` — do not restage competitor IP from examples into campaign pixels.
3. Write **provider-ready prompt + negative prompt + settings** for an **F&P Generate** job.
4. Attach locked refs every time when present.
5. **Register** the result as a campaign asset.
6. Critic scores → user review.

## Workflow

### Step 1 — Lock inputs

- Campaign DNA + locked refs → product facts, label, invariants.
- Brief: offer/claim (user/DNA only), aspect, mode.
- Open the example for the chosen mode; note hierarchy, CTA treatment, series locks.

### Step 2 — Design to craft

Hold [`references/craft.md`](references/craft.md):

- One dominant headline; product/person as focal; CTA as discrete control.
- Large display type (serif **or** bold sans) + quiet support.
- Limited palette; one accent for CTA / overlays.
- Soft studio or natural light; shallow DOF for lifestyle; reflective surfaces for luxury glass/metal.
- Series: repeat logo placement, footer, CTA treatment.

### Step 3 — Prompt for Generate

Assemble:

1. Preservation block (locked product unchanged when refs attached).
2. Layout regions (headline / hero / CTA) + safe margins + true aspect.
3. Quoted copy strings only from brief/DNA.
4. Photoreal look: one primary light, materials by name, camera/DOF when useful.
5. Negative: cartoon/CGI plastic, blank packs, melted type, stock HDR glow, cluttered equal-weight collage, missing CTA.

### Step 4 — Return

Register assets; Critic before user review. No silent regen.

## Critic bar (before user review)

Fail any candidate that:

1. Is not photoreal (cartoon / CGI plastic / stock HDR glow).
2. Is a bare packshot when an **ad** was requested (no headline / no CTA).
3. Shows blank or illegible packs when labeled product was required.
4. Breaks DNA / locked pack identity, or shows real competitor IP.
5. Puts key type or CTA under unsafe edges / platform chrome.
6. In a series: inconsistent logo, footer, or CTA treatment across frames.

## Common mistakes

- Packshot-only when Wardell asked for an ad
- Equal weight on logo, product, and copy
- Invented claims / badges
- Melting type; missing CTA button/bar
- Ignoring the selected mode’s example structure
- SuperCMO MCP instead of F&P Generate

## Reference

- [`references/craft.md`](references/craft.md)
- [`references/EXAMPLE_INDEX.md`](references/EXAMPLE_INDEX.md)
- [`references/examples/`](references/examples/)
- [`../ORIGINALITY.md`](../ORIGINALITY.md)
- [`../generating-image-ads/`](../generating-image-ads/) — general static ads
