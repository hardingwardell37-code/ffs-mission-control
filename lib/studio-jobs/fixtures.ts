import { mockAnalyzeBrief } from "./mock-analysis";
import type { CreateStudioJobInput } from "./repository";
import type { StudioJobSource } from "../../types/domain";

export const DEMO_JOB_TITLES = [
  "Northline — 60s cinematic concept film",
  "Pulse App — launch static + 15s social",
] as const;

const CINEMATIC_BRIEF = `Project: Northline Outdoor — "First Light" concept film

We need a 45–60 second cinematic brand film for our autumn campaign. Audience: outdoor enthusiasts 28–45 who value quiet craftsmanship over hype.

Deliverables:
- 1× hero concept film, 16:9, ~60 seconds, color graded, no VO (music bed only — we will license separately)
- 3× still keyframes pulled from the film for OOH and site hero
- Optional 9:16 vertical cut for Stories / Reels later (scope if budget allows)

Creative direction:
Dawn mist over a ridge trail. A solo runner in muted earth tones. Camera is restrained — slow push-ins, practical light, no stock "epic drone" clichés. Product (Northline shell jacket) appears naturally; do not hero-shot logos for more than 2 seconds.

Must include on-screen end card copy exactly: "Northline. Built for the quiet miles."

Brand constraints:
- Palette: charcoal, fog grey, one warm amber accent (#C47A3A)
- No celebrity lookalikes, no competing outdoor logos in frame
- Original cinematography language only — references are directional, not to copy

Budget guidance from client: $2,800–$3,900 all-in creative production (gen + edit supervision). Prefer staying under $3,500.
Deadline: first cut for internal review in 10 business days; final master 5 days after feedback.

Questions open: music rights handled by client; confirm whether we need alt end-card without tagline for paid social.
`;

const SOCIAL_BRIEF = `Quick ask — Pulse productivity app launch creatives

Need:
1) One square static (1:1) feed post announcing "Pulse 2.0 is live"
2) One 15s vertical (9:16) motion bumper for Reels / TikTok — product UI mock is attached conceptually: dark UI, soft green accent, calm motion

Tone: clean, modern SaaS, not meme-y. Tagline on the static: "Less noise. More done."

Source: Fiverr brief paste. Client budget ~$450. No talent. No music buyout needed (use library bed they provide).

Deadline: end of week.
`;

export type DemoJobFixture = {
  title: (typeof DEMO_JOB_TITLES)[number];
  source: StudioJobSource;
  rawBrief: string;
  clientNotes: string;
  clientBudgetCents: number;
  quotedPriceCents: number;
  maxProductionBudgetCents: number;
  channelFeeBps: number;
  contingencyBps: number;
  deadlineDaysFromNow: number;
};

export const DEMO_JOB_FIXTURES: DemoJobFixture[] = [
  {
    title: DEMO_JOB_TITLES[0],
    source: "email",
    rawBrief: CINEMATIC_BRIEF,
    clientNotes: "Inbound from brand marketing lead via email. Prefer Runway for hero motion; stills for OOH.",
    clientBudgetCents: 350_000,
    quotedPriceCents: 320_000,
    maxProductionBudgetCents: 90_000,
    channelFeeBps: 0,
    contingencyBps: 1000,
    deadlineDaysFromNow: 15,
  },
  {
    title: DEMO_JOB_TITLES[1],
    source: "fiverr",
    rawBrief: SOCIAL_BRIEF,
    clientNotes: "Short social package. Keep gen spend tight; one revision round included.",
    clientBudgetCents: 45_000,
    quotedPriceCents: 42_000,
    maxProductionBudgetCents: 12_000,
    channelFeeBps: 2000,
    contingencyBps: 1000,
    deadlineDaysFromNow: 5,
  },
];

export function demoFixtureToCreateInput(
  fixture: DemoJobFixture,
  organizationId: string,
  createdBy: string,
): CreateStudioJobInput {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() + fixture.deadlineDaysFromNow);
  return {
    organizationId,
    createdBy,
    title: fixture.title,
    rawBrief: fixture.rawBrief,
    source: fixture.source,
    clientNotes: fixture.clientNotes,
    clientBudgetCents: fixture.clientBudgetCents,
    quotedPriceCents: fixture.quotedPriceCents,
    maxProductionBudgetCents: fixture.maxProductionBudgetCents,
    channelFeeBps: fixture.channelFeeBps,
    contingencyBps: fixture.contingencyBps,
    deadline: deadline.toISOString(),
    status: "needs_review",
  };
}

export function analysisForDemoFixture(fixture: DemoJobFixture) {
  return mockAnalyzeBrief(fixture.rawBrief, fixture.title);
}
