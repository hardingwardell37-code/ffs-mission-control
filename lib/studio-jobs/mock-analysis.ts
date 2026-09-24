import type { JobWorkflowStep, StudioJobDecision } from "../../types/domain";

export type MockBriefAnalysisResult = {
  deliverables: string[];
  dimensions: string[];
  durations: string[];
  references: string[];
  exactText: string[];
  brandConstraints: string[];
  rightsConcerns: string[];
  missingInformation: string[];
  confidence: number;
  decision: StudioJobDecision;
  rationale: string;
  modelUsed: "mock";
  analysisJson: Record<string, unknown>;
  steps: JobWorkflowStep[];
  estimatedTotalCostCents: number;
};

const VIDEO_HINTS = /\b(video|film|cinematic|commercial|spot|reel|motion|trailer|animat)/i;
const IMAGE_HINTS = /\b(image|still|static|poster|key.?art|thumbnail|banner|social\s*post|carousel)/i;
const ASPECT_16_9 = /\b(16:?9|widescreen|landscape|1920\s*[x×]\s*1080|cinema)/i;
const ASPECT_9_16 = /\b(9:?16|vertical|stories|reels?|tiktok|shorts?)/i;
const ASPECT_1_1 = /\b(1:?1|square|instagram\s*feed)/i;
const DURATION_SEC = /(\d{1,3})\s*(?:s|sec|secs|second|seconds)\b/i;
const DURATION_MIN = /(\d{1,2})\s*(?:m|min|mins|minute|minutes)\b/i;
const BUDGET_HINT = /\$\s*([\d,]+(?:\.\d{1,2})?)/;
const RIGHTS_HINTS = /\b(exclusive|buyout|talent|music\s*license|trademark|logo|celebrity|likeness|stock\s*footage)\b/i;
const BRAND_HINTS = /\b(brand\s*guidelines?|pantone|hex|typeface|font|logo\s*lockup|do\s*not)\b/i;

function detectAspect(brief: string): string[] {
  const dims: string[] = [];
  if (ASPECT_16_9.test(brief)) dims.push("16:9");
  if (ASPECT_9_16.test(brief)) dims.push("9:16");
  if (ASPECT_1_1.test(brief)) dims.push("1:1");
  if (!dims.length) {
    if (VIDEO_HINTS.test(brief)) dims.push("16:9");
    else if (IMAGE_HINTS.test(brief)) dims.push("1:1");
    else dims.push("16:9");
  }
  return dims;
}

function detectDurations(brief: string): string[] {
  const out: string[] = [];
  const sec = brief.match(DURATION_SEC);
  if (sec) out.push(`${sec[1]}s`);
  const min = brief.match(DURATION_MIN);
  if (min) out.push(`${min[1]}m`);
  if (!out.length && VIDEO_HINTS.test(brief)) {
    if (/\b(spot|commercial|ad)\b/i.test(brief)) out.push("30s");
    else if (/\b(film|cinematic|concept)\b/i.test(brief)) out.push("60s");
    else out.push("15s");
  }
  return out;
}

function wantsVideo(brief: string): boolean {
  if (VIDEO_HINTS.test(brief)) return true;
  if (IMAGE_HINTS.test(brief) && !VIDEO_HINTS.test(brief)) return false;
  return brief.length > 800;
}

function wantsStill(brief: string): boolean {
  return IMAGE_HINTS.test(brief) || !wantsVideo(brief);
}

function extractQuotedPhrases(brief: string): string[] {
  const matches = brief.match(/"([^"]{2,120})"/g) ?? [];
  return matches.map((m) => m.slice(1, -1)).slice(0, 8);
}

function buildSteps(brief: string, video: boolean, still: boolean): JobWorkflowStep[] {
  const steps: JobWorkflowStep[] = [];
  let order = 1;

  if (still) {
    const unit = 8;
    const attempts = 2;
    steps.push({
      order: order++,
      modality: "image",
      provider: "openai_image",
      model: "gpt-image-1",
      purpose: "Hero still / key visual exploration",
      inputs: { from: "brief" },
      expectedOutputs: { count: attempts, aspect: detectAspect(brief)[0] ?? "1:1" },
      estimatedAttempts: attempts,
      unitCostCents: unit,
      estimatedTotalCents: unit * attempts,
    });
  }

  if (video) {
    const unit = 120;
    const attempts = /\b(cinematic|concept.?film|commercial)\b/i.test(brief) ? 3 : 2;
    steps.push({
      order: order++,
      modality: "video",
      provider: "runway",
      model: "gen4_turbo",
      purpose: "Primary motion / concept cut",
      inputs: { from: still ? "hero_still" : "brief" },
      expectedOutputs: { count: 1, duration: detectDurations(brief)[0] ?? "15s" },
      estimatedAttempts: attempts,
      unitCostCents: unit,
      estimatedTotalCents: unit * attempts,
    });

    if (/\b(social|reel|stories?|tiktok|shorts?)\b/i.test(brief) || ASPECT_9_16.test(brief)) {
      const socialUnit = 90;
      steps.push({
        order: order++,
        modality: "video",
        provider: "fal_minimax_h3",
        model: "minimax-hailuo",
        purpose: "Vertical social cut",
        inputs: { from: "primary_motion" },
        expectedOutputs: { count: 1, aspect: "9:16" },
        estimatedAttempts: 2,
        unitCostCents: socialUnit,
        estimatedTotalCents: socialUnit * 2,
      });
    }
  }

  if (!steps.length) {
    steps.push({
      order: 1,
      modality: "image",
      provider: "grok_imagine",
      model: "grok-imagine",
      purpose: "Concept stills from brief",
      inputs: { from: "brief" },
      expectedOutputs: { count: 2 },
      estimatedAttempts: 2,
      unitCostCents: 10,
      estimatedTotalCents: 20,
    });
  }

  return steps;
}

/**
 * Deterministic mock brief analysis. model_used is always "mock".
 * Never claims live LLM / Astra. Never fakes successful media generation.
 */
export function mockAnalyzeBrief(rawBrief: string, title = ""): MockBriefAnalysisResult {
  const brief = `${title}\n${rawBrief}`.trim();
  const video = wantsVideo(brief);
  const still = wantsStill(brief) || video;
  const dimensions = detectAspect(brief);
  const durations = detectDurations(brief);
  const exactText = extractQuotedPhrases(brief);
  const deliverables: string[] = [];
  if (video) deliverables.push(durations.length ? `Video (${durations.join(", ")})` : "Video");
  if (still) deliverables.push(dimensions.includes("1:1") || IMAGE_HINTS.test(brief) ? "Static image(s)" : "Key art / stills");
  if (!deliverables.length) deliverables.push("Creative package (TBD)");

  const brandConstraints: string[] = [];
  if (BRAND_HINTS.test(brief)) brandConstraints.push("Follow stated brand / type / color constraints in brief");
  if (/\boriginal\b/i.test(brief)) brandConstraints.push("Original creative only — no copy of referenced ads");

  const rightsConcerns: string[] = [];
  if (RIGHTS_HINTS.test(brief)) rightsConcerns.push("Brief mentions rights-sensitive terms — human rights review required");
  if (/\b(nike|apple|disney|marvel|coca-?cola|spotify)\b/i.test(brief)) {
    rightsConcerns.push("Named third-party brand detected — confirm client owns usage rights");
  }

  const missingInformation: string[] = [];
  if (!BUDGET_HINT.test(brief)) missingInformation.push("Client budget not stated in brief text");
  if (!durations.length && video) missingInformation.push("Target duration not explicit");
  if (!exactText.length && /\b(tagline|headline|copy|CTA)\b/i.test(brief)) {
    missingInformation.push("Exact on-screen copy / CTA wording not quoted");
  }
  if (!/\b(deadline|due|by\s+\w+\s+\d)/i.test(brief)) missingInformation.push("Deadline not stated in brief");

  const steps = buildSteps(brief, video, still);
  const estimatedTotalCostCents = steps.reduce((sum, s) => sum + s.estimatedTotalCents, 0);

  let decision: StudioJobDecision = "review";
  let confidence = 0.55;
  if (rightsConcerns.length > 1 || missingInformation.length >= 3) {
    decision = "review";
    confidence = 0.4;
  } else if (video && estimatedTotalCostCents > 50_000) {
    decision = "review";
    confidence = 0.5;
  } else if (deliverables.length && missingInformation.length <= 1 && rightsConcerns.length === 0) {
    decision = "accept";
    confidence = 0.72;
  }
  if (/\b(impossible|no\s*budget|pro\s*bono\s*only)\b/i.test(brief)) {
    decision = "reject";
    confidence = 0.65;
  }

  const rationaleParts = [
    `Mock heuristic parse (${video ? "video" : "still"}-leaning).`,
    `Draft workflow uses existing providers only (runway / grok_imagine / fal_minimax_h3 / openai_image).`,
    `Estimated gen spend ~$${(estimatedTotalCostCents / 100).toFixed(2)} before contingency.`,
  ];
  if (rightsConcerns.length) rationaleParts.push("Rights flags need human gate (job_rights).");
  if (missingInformation.length) rationaleParts.push(`${missingInformation.length} gap(s) to clarify before production.`);

  return {
    deliverables,
    dimensions,
    durations,
    references: [],
    exactText,
    brandConstraints,
    rightsConcerns,
    missingInformation,
    confidence,
    decision,
    rationale: rationaleParts.join(" "),
    modelUsed: "mock",
    analysisJson: {
      heuristics: {
        video,
        still,
        aspectHints: dimensions,
        durationHints: durations,
      },
      note: "Phase 1 mock analysis — not a live LLM. Phase 2 will replace model_used.",
    },
    steps,
    estimatedTotalCostCents,
  };
}
