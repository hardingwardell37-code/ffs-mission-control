---
name: generating-product-photos
description: |
  ALWAYS read this skill before F&P campaign Generate / packshot / product-photo asks — before writing any provider prompt. Turns Campaign DNA + locked product refs into commercial photography: packshots, hero, lifestyle, close-up, studio, and related modes. Holds pack identity identical across every frame. Triggers: F&P Generate packshots, "product photo", "packshot", "studio shot", "lifestyle shot", "hero image", "close-up", energy-drink / labeled-pack stills. Not for finished ads with headline/offer/CTA (use generating-image-ads) or commercials (use generating-ad-videos).
license: Apache-2.0
metadata:
  version: "0.2.0-fp"
  category: creative
  summary: "F&P Studio adaptation: directs commercial product photography for campaign Generate jobs — lighting, framing, lens language, pack-identity lock — across studio/hero/lifestyle/close-up and other modes."
  adapted_from: "SupercmoHQ/superCMO-skills generating-product-photos (Apache-2.0)"
---

# Product Photography (F&P Studio)

Turn campaign product DNA into commercial stills via **F&P Generate** jobs (Grok Imagine and other configured providers). Marketplace listing galleries are out of scope. A finished advertisement with headline, offer, or CTA belongs to `generating-image-ads`. Anything whose subject isn’t a product should not use this skill.

## Originality guard

**Read [`../ORIGINALITY.md`](../ORIGINALITY.md) before every job.** Never Coke / competitor trademarks, ribbons, slogans, logos, polar bears, or copied ad frames. **ALWAYS** invent original fictional brand/pack labels grounded in Campaign DNA. **Blank unlabeled cans = FAIL.** Photoreal editorial/commercial — not cartoon or CGI plastic. Lead Research owns DNA; Creative Director explores; Critic scores before user review.

## Tool mapping (F&P)

Do **not** call SuperCMO’s private `image_generate` MCP.

1. Write a **provider-ready prompt** + **negative prompt** + settings (aspect ratio, resolution tier, reference asset IDs) for an F&P **Generate** job.
2. Attach locked product / pack refs from the campaign when present — identity rides on refs + DNA, not on guessing.
3. After the job completes, **register the result as a campaign asset**.
4. Do not self-score with a vision loop; hand to **Critic**, then user review.

## Workflow

### Step 1: Read what you have

- **Campaign DNA and/or locked refs present** → take: what the product is; how a person physically uses it; moving parts; and the details that must stay identical (silhouette, colorway, **original label lockup from DNA**).
- **Look at locked product images before describing them.** Take the product only from what the image + DNA show — not from competitor memory or filenames.
- **Product / DNA not supplied** → don’t invent a real-world brand. Ask for DNA or upload; originality still requires a fictional labeled pack once generation proceeds.

### Step 2: Interview

**Skip when the brief already makes the shot obvious.** Otherwise ask once, at most four questions, with a free-text way out.

| Ask | When |
| --- | --- |
| **The product / DNA** — pack, colour, distinguishing features, label intent | No DNA and no locked ref. Prefer waiting for a ref. |
| **Brand guidelines from DNA** — palette, art direction, never-in-frame list, type | Brief mentions none. |
| **Who the buyer is** | Frame must speak to a particular buyer. |
| **How many frames**, and where they run | Destination changes the crop. |

When the user waives questions and DNA/refs are in hand, default to **studio**, say which settings you took, and continue.

### Step 3: Select the mode and read the reference

| The ask is about… | Mode | Reference |
| --- | --- | --- |
| Product alone on a clean background | **studio** | `references/mode-studio.md` |
| Product somewhere real, lived with | **lifestyle** | `references/mode-lifestyle.md` |
| One polished campaign lead frame | **hero** | `references/mode-hero.md` |
| Worn, held, or applied | **on-model** | `references/mode-on-model.md` |
| Texture / tight crop | **close-up** | `references/mode-close-up.md` |
| Arranged overhead | **flat-lay** | `references/mode-flat-lay.md` |
| Holiday / season moment | **seasonal** | `references/mode-seasonal.md` |
| Feature callouts drawn on | **infographic** | `references/mode-infographic.md` |
| Unexpected / scroll-stopping | **creative** | `references/mode-creative.md` |
| Suspended mid-air | **floating** | `references/mode-floating.md` |

**Energy-drink packshots** usually land on **studio**, **hero**, **close-up**, or **lifestyle**. Prefer those modes; others remain available when the brief asks.

Priority when rows overlap: person → on-model; drawn text → infographic; overhead plane → flat-lay; single property → close-up; occasion-as-sell → seasonal; unexpected → creative.

### Step 4: Write the product description

One description, reused unchanged in every prompt.

With a locked ref attached: cover only what the photo cannot — angle, state of moving parts, action. Without a ref: carry form, closure, materials/finish surface-by-surface, and any action from DNA.

**Describe the original DNA label as a designed lockup to preserve** (brand wordmark + flavor line as DNA states) — do not invent Coke-like scripts. Prefer locking label identity via reference images when available; spelling out every printed character invites warped redraws.

### Step 5: Choose provider settings (not SuperCMO model enums)

Map to whatever F&P Generate exposes for the campaign (e.g. Grok Imagine):

| Need | Guidance |
| --- | --- |
| Default photoreal packshot | Narrative paragraph prompt; photoreal commercial settings |
| Drawn callouts / designed layout on the still | Prefer a text-strong provider/settings profile if available; keep product label from refs |
| Prior refusal / failure | Retry once with tightened negatives and clearer material language |

If the user named a provider or preset, use that first.

### Step 6: Write the prompt

- Follow the mode guide; carry the Step 4 description into each prompt.
- Read `references/photographic-craft.md` — light, shadow, colour, material, optics; style anchors **translated into physical terms** (never “in the style of [photographer]” in the prompt); quality markers + Avoid block.
- **Assembly order:** mode preservation block → scene from mode fields → quality-marker line → Avoid / negative-prompt block (plus F&P originality negatives: no competitor marks, no blank packs, no cartoon/CGI plastic).
- With refs: state fidelity — the pack in frame is the locked campaign product, unchanged. Don’t re-describe details the photo already settles.
- Multiple refs: label Image 1, Image 2… and say what each is.
- Scene-specific exclusions go in the **negative prompt** (F&P supports negatives) and/or as positive “want instead” phrasing.
- **A rival’s name has no place in the prompt** — not even as something to avoid by name. Describe geometry and palette instead. See ORIGINALITY.md.
- No internal mode/file names in the prompt.

### Step 7: Generate (F&P Generate job)

Submit one Generate job per deliverable (or one batched job if the studio UI supports multi-request):

- Fields: prompt, negative prompt, aspect ratio, resolution, reference asset IDs.
- Default resolution: studio default unless the user asked higher.
- **Locked product refs attached every time** when they exist.
- Take ratio from the user or destination; otherwise state the default you took.
- **One image unless the brief asked for a set.** Don’t burn spend comparing providers unprompted.
- Pending jobs: poll status; **never** re-submit a pending job as a new Generate.
- Don’t vision-score your own output; register asset → Critic → user.

### Step 8: Return

- Confirm asset registration (URLs / asset IDs) once every frame finished.
- Present a set in the agreed order.

## Producing a set

1. Agree the frame list before generating.
2. Fix one look into every prompt unchanged.
3. Same refs and provider profile on every frame.
4. Vary only what each frame shows.
5. Make frames genuinely different.
6. For a sequence, decide order first.

## Common mistakes

- Freeform prompt instead of the mode checklist.
- Skipping interview when something load-bearing is missing.
- Interaction the product doesn’t support.
- Naming a brand, photographer, or competitor instead of describing the look.
- Blank cans / unlabeled packs.
- Regenerating without user ask or Critic fail list.

## Edge cases

- Off-brief output → deliver, note what’s off, wait for user/Critic; don’t silent-regen.
- Rejection with no reason → ask what missed before re-running.
- Safety/policy → rename the blocked element to a workable original stand-in; don’t slip into competitor IP.
- Provider/config error → relay the studio error/hint.

## Reference

Mode guides (checklist at end of each):

- `references/mode-studio.md`, `mode-lifestyle.md`, `mode-hero.md`, `mode-on-model.md`, `mode-close-up.md`, `mode-flat-lay.md`, `mode-seasonal.md`, `mode-infographic.md`, `mode-creative.md`, `mode-floating.md`

Shared craft (every job):

- `references/photographic-craft.md`
- [`../ORIGINALITY.md`](../ORIGINALITY.md)
