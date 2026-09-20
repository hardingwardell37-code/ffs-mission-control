# F&P Studio skills (adapted)

Lean creative skills for portfolio campaign work — starting with **Last Sip First** (+One Energy) and future campaigns.

## Credit

Adapted from [SupercmoHQ/superCMO-skills](https://github.com/SupercmoHQ/superCMO-skills) (**Apache-2.0**).  
See [`ATTRIBUTION.md`](ATTRIBUTION.md) for source URL, adaptation date, and license notice.  
Hard F&P rules: [`ORIGINALITY.md`](ORIGINALITY.md).

## Adapted vs omitted

| Adapted (this tree) | Omitted (do not pull in) |
| --- | --- |
| `generating-product-photos` | `cloning-video-ads` (and anything that copies competitor ads) |
| `generating-image-ads` | Full SuperCMO monorepo / MCP stack |
| `generating-ad-videos` | UGC, cartoon, competitor-research pipelines, evals, fonts |
| `high-end-photoreal-ads` | — (F&P style lock; grounded in local example refs) |
| `adscoop-to-fp-handoff` | — (F&P research handoff; AdScoop external, not vendored) |

## When to use each skill

| Ask | Skill |
| --- | --- |
| Packshot, studio / hero / lifestyle / close-up product still | [`generating-product-photos/`](generating-product-photos/) |
| Static social / banner / offer ad with headline & CTA | [`generating-image-ads/`](generating-image-ads/) |
| High-end photoreal ads (not packshots alone) — F&P quality bar / style lock | [`high-end-photoreal-ads/`](high-end-photoreal-ads/) |
| Product commercial / brand film / TV-style spot | [`generating-ad-videos/`](generating-ad-videos/) |
| Meta Ad Library winners via AdScoop → F&P campaign DNA / Generate | [`adscoop-to-fp-handoff/`](adscoop-to-fp-handoff/) |

Plain product photography with **no** ad message → product-photos.  
Finished ad layout with offer / claim → image-ads (general).  
**Use `high-end-photoreal-ads` when Wardell wants high-end photoreal ads** (editorial / series / luxury end card / product system) — not packshots alone. Keep `generating-image-ads` as general; this skill is the F&P quality bar / style lock.  
Moving commercial → ad-videos.
AdScoop / Meta Library research into F&P → [`adscoop-to-fp-handoff/`](adscoop-to-fp-handoff/) (swipe principles only; AdScoop is external research, not a generator).

## Critic bar

Before user review, **Critic** scores every candidate:

1. **Photoreal** — editorial / commercial, not cartoon or CGI plastic  
2. **Labeled packs** — original fictional labels grounded in Campaign DNA; **blank unlabeled cans = FAIL**  
3. Lighting / lens, composition, originality (no Coke / competitor IP), prompt fidelity  

See [`ORIGINALITY.md`](ORIGINALITY.md) and [`../roster/critic.md`](../roster/critic.md).

## How generation works here

F&P Studio does **not** call SuperCMO’s private `image_generate` / `video_generate` MCP.

Agents:

1. Read **Campaign DNA** + locked refs when present  
2. Write a **provider-ready prompt + negative prompt + settings** for an F&P **Generate** job (Grok Imagine and other configured providers)  
3. **Register** the result as a campaign asset  
4. Hand to Critic, then user review  

## Roles

- **Lead Research** (Grok Bot) owns DNA  
- **Creative Director** explores  
- **Critic** scores before user review  

## Optional regen brief

[`last-sip-first-regen-brief.md`](last-sip-first-regen-brief.md) — short brief for regenerating Last Sip First storyboard stills **after** this skills PR merges (regen itself is a follow-up).
