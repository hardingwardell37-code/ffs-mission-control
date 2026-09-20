# ORIGINALITY.md — hard rules for F&P Studio generation

These rules override craft defaults in every adapted skill under `agents/skills/`.
Read this before writing any packshot, static-ad, or commercial-video prompt.

## Never

- **Coke / Coca-Cola IP** — red-and-white script, contour bottle silhouette as brand cue, ribbon waves that read as Coke, polar bears, Christmas trucks, or any slogan associated with that brand family.
- **Competitor trademarks** — logos, wordmarks, slogans, distinctive pack trade dress, or mascots belonging to real beverage / energy brands (or any real brand not owned by the campaign).
- **Copied ad frames** — do not recreate, “clone,” or closely restage competitor commercials or stills. Competitor research may inform *strategy*; it must never dictate *pixels*.
- **Blank unlabeled cans / packs** — a can, bottle, or carton with empty metal/plastic and no invented label is a **FAIL**. Blank packs are not “clean”; they are incomplete product identity.
- **Cartoon / CGI plastic look** — reject shiny toy surfaces, illustration, anime, or uncanny CGI when the brief asks for photoreal editorial / commercial photography.

## Always

- **Invent original fictional brand / pack labels** grounded in **Campaign DNA** (and locked refs when present). Labels must look printed and legible — brand name, flavor line, and supporting lockup as DNA specifies.
- **Photoreal editorial / commercial** language: real light, real materials, lens and contact shadow — not stock-catalogue glow or plastic sheen.
- **Hold pack identity** across a set: same silhouette, colorway, and label treatment once DNA + locked refs define them.

## Roles

| Role | Owns |
| --- | --- |
| **Lead Research** (existing Grok Bot) | Campaign DNA / research. Not a third in-app agent. |
| **Creative Director** | Exploration — N candidates via studio Generate; original labels from DNA. |
| **Critic** | Scores assets **before** user review (photoreal, labeled packs, lighting, originality, prompt fidelity). Feedback only. |

Wardell owns final pick, lock, and publish.

## Critic bar (table stakes)

Before user review, Critic must fail any asset that:

1. Is not photoreal when the brief required it (cartoon / CGI plastic).
2. Shows blank or illegible packs when a labeled product was required.
3. Shows real Coke / competitor trademarks, ribbons, slogans, logos, polar bears, or copied ad frames.
4. Ignores Campaign DNA or locked refs when those were present.

## Where this lives in the loop

1. Read Campaign DNA + locked refs (when present).
2. Creative Director writes provider-ready prompts for **F&P Generate** jobs.
3. Register results as campaign assets.
4. Critic scores against this file + the role rubric.
5. User review only after Critic has scored.

See also: [`README.md`](README.md), [`../roster/critic.md`](../roster/critic.md), [`../roster/creative-director.md`](../roster/creative-director.md).
