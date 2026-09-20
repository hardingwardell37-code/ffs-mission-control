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

## When to use each skill

| Ask | Skill |
| --- | --- |
| Packshot, studio / hero / lifestyle / close-up product still | [`generating-product-photos/`](generating-product-photos/) |
| Static social / banner / offer ad with headline & CTA | [`generating-image-ads/`](generating-image-ads/) |
| Product commercial / brand film / TV-style spot | [`generating-ad-videos/`](generating-ad-videos/) |

Plain product photography with **no** ad message → product-photos.  
Finished ad layout with offer / claim → image-ads.  
Moving commercial → ad-videos.

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
