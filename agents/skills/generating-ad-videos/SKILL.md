---
name: generating-ad-videos
description: |
  ALWAYS read this skill before F&P campaign Generate / commercial video / brand-film asks. Makes a product ad video — product showcase or story/lifestyle commercial — from Campaign DNA + locked refs, holding pack identity across clips. Triggers: F&P Generate commercials, "product ad", "commercial", "TV ad", "brand film", "product-hero video". Not for UGC/reviews and not for cloning competitor ads.
license: Apache-2.0
metadata:
  version: "0.3.0-fp"
  category: creative
  summary: "F&P Studio adaptation: cinematic product commercials via Generate jobs — storyboarded clips, pack-identity lock, original DNA labels, stitch-ready provider prompts."
  adapted_from: "SupercmoHQ/superCMO-skills generating-ad-videos (Apache-2.0)"
---

# Product ads / commercials (F&P Studio)

Turn campaign product DNA into a finished commercial via **F&P Generate** video jobs. Optional voiceover (default on) and on-camera presenter (only when the brief needs a person).

## Originality guard

**Read [`../ORIGINALITY.md`](../ORIGINALITY.md) before every job.** Never Coke / competitor trademarks, ribbons, slogans, logos, polar bears, or **copied / cloned competitor ad frames**. **ALWAYS** invent original fictional brand/pack labels grounded in Campaign DNA. **Blank unlabeled cans = FAIL.** Photoreal commercial — not cartoon/CGI plastic. Lead Research owns DNA; Creative Director explores; Critic scores before user review.

**Do not use or recreate upstream `cloning-video-ads` patterns.** Competitor research may inform strategy; it must never dictate shot-for-shot pixels.

## Tool mapping (F&P)

Do **not** call SuperCMO’s private `video_generate` / `video_stitch` MCP as a hard dependency.

1. Write **provider-ready prompts** (per clip) + negative prompts + settings for F&P Generate video jobs.
2. Attach locked product (and presenter) refs; keep the same product description string on every clip.
3. Prefer studio stitch / export when available; otherwise deliver ordered clips and note they aren’t joined.
4. **Register** the finished spot (and clips if requested) as campaign assets.
5. Critic → user review.

Default delivery: **9:16** unless the user asked otherwise. Prefer the campaign’s configured fast commercial video provider unless the user named one.

## Workflow

### Step 1: Read what you have

- DNA + locked refs → product, use mechanic, invariants, **original label**.
- Analyze every supplied image for what it shows; role of each image comes from the brief.
- No product → don’t guess a real brand; ask.

### Step 2: Interview

Skip when brief settles product, intent, length. Otherwise ask once: product/DNA; length (15/30/45/60); presenter on camera?; voiceover? (default yes). When waived: 15s, no actor, VO on — state and continue.

### Step 3: Write the product description

One description, reused unchanged every storyboard/prompt:

- Material/finish surface-by-surface  
- True size vs hand/surface  
- Two to five visual anchors from refs/DNA  
- Mechanism and allowed actions  
- **DNA label lockup preserved via refs** — don’t spell every printed character into prompts  

### Step 4: Plan the concept

Read `references/commercial-craft.md` end to end.

- Choose **angle** (product-only vs person-led)  
- Fix **register** and one setting; hold across the ad  
- Presenter casting only if on camera — one look held end to end  
- Split length into clips within provider min/max durations  
- Lay the **arc**; never two same-scale shots back to back; close on **packshot**  
- Write it down: clips, shots, VO lines sized ~2 words/sec (3 ceiling)  

### Step 5: Voiceover (if any)

Words are always VO over picture — never lip-sync. Only claims user/DNA supplied. If no words, skip.

### Step 6: Show concept and wait

Presenter (if any), product look, per-clip action, per-clip VO. Expect edits. Don’t generate clips until approved (unless waived).

### Step 7: Cast presenter (if on camera)

Cast once; reuse the same reference image on every clip. Wardrobe accent ties to product palette (`commercial-craft.md`). No competitor logos on wardrobe.

### Step 8: Storyboards

One sheet per clip (16:9 sheets with panels are fine even if deliverable is 9:16). Show all sheets; confirm pack identity in every panel before spend. Rebuild only sheets that fail.

### Step 9: Write clip prompts

One provider-ready prompt per clip: duration, panels, unchanged product description, VO segment, labelled media order (sheet, product, presenter). VO over picture, never lip-sync.

### Step 10: Generate (F&P Generate)

- One request per clip; same aspect ratio and resolution across the spot  
- Prompt + negative prompt + refs in labelled order; audio on when the provider supports it  
- Poll pending; never double-submit  
- Don’t silent-regen  

### Step 11: Stitch and return

Join in order when studio stitch/export exists; else return ordered clips. Register campaign assets. Critic before user review.

## Edge cases

- No product → stop  
- Wrong sheet → remake sheet only  
- One clip fails → resubmit only that clip  
- Clip ≠ sheet → hand over, let user decide  
- Safety on presenter twice → say what’s blocked; recast originally  
- Post-approval change → redo from earliest touched step  
- General b-roll with no product sell → out of scope here  
- **Never** route into competitor-ad cloning  

## Reference

- `references/commercial-craft.md`
- [`../ORIGINALITY.md`](../ORIGINALITY.md)
