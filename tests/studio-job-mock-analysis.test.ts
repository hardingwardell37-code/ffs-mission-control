import { describe, expect, it } from "vitest";
import { mockAnalyzeBrief } from "../lib/studio-jobs/mock-analysis";
import { DEMO_JOB_FIXTURES, DEMO_JOB_TITLES } from "../lib/studio-jobs/fixtures";

const ALLOWED_PROVIDERS = new Set([
  "runway",
  "grok_imagine",
  "openai_image",
  "fal_minimax_h3",
  "fal_minimax_h3_max",
  "google_omni",
]);

describe("mockAnalyzeBrief", () => {
  it("marks model_used as mock and drafts video workflow for cinematic brief", () => {
    const result = mockAnalyzeBrief(DEMO_JOB_FIXTURES[0].rawBrief, DEMO_JOB_FIXTURES[0].title);
    expect(result.modelUsed).toBe("mock");
    expect(result.deliverables.some((d) => /video/i.test(d))).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(result.estimatedTotalCostCents).toBeGreaterThan(0);
    for (const step of result.steps) {
      expect(ALLOWED_PROVIDERS.has(step.provider)).toBe(true);
      expect(step.provider).not.toMatch(/higgsfield/i);
    }
  });

  it("detects still + short social cues", () => {
    const result = mockAnalyzeBrief(DEMO_JOB_FIXTURES[1].rawBrief, DEMO_JOB_FIXTURES[1].title);
    expect(result.modelUsed).toBe("mock");
    expect(result.dimensions.length).toBeGreaterThan(0);
    expect(result.steps.some((s) => s.modality === "image" || s.modality === "video")).toBe(true);
  });

  it("is deterministic for the same brief", () => {
    const a = mockAnalyzeBrief("15s reel 9:16 product UI", "Pulse");
    const b = mockAnalyzeBrief("15s reel 9:16 product UI", "Pulse");
    expect(a).toEqual(b);
  });
});

describe("demo fixtures", () => {
  it("exposes two distinct seed titles", () => {
    expect(DEMO_JOB_TITLES).toHaveLength(2);
    expect(new Set(DEMO_JOB_TITLES).size).toBe(2);
  });
});
