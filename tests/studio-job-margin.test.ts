import { describe, expect, it } from "vitest";
import {
  STUDIO_JOB_APPROVAL_KEYS,
  STUDIO_JOB_SOURCES,
  STUDIO_JOB_STATUSES,
  computeExpectedGrossMargin,
  isStudioJobApprovalKey,
} from "../lib/domain/studio-job";

describe("Job Operator margin helper", () => {
  it("computes channel fee and margin with contingency", () => {
    const result = computeExpectedGrossMargin({
      quotedPriceCents: 100_000,
      estimatedGenCents: 20_000,
      contingencyBps: 1000,
      channelFeeBps: 1000,
    });
    expect(result.channelFeeCents).toBe(10_000);
    expect(result.genWithContingencyCents).toBe(22_000);
    expect(result.expectedGrossMarginCents).toBe(68_000);
  });

  it("handles zero channel fee and zero contingency", () => {
    const result = computeExpectedGrossMargin({
      quotedPriceCents: 50_000,
      estimatedGenCents: 10_000,
      contingencyBps: 0,
      channelFeeBps: 0,
    });
    expect(result.channelFeeCents).toBe(0);
    expect(result.genWithContingencyCents).toBe(10_000);
    expect(result.expectedGrossMarginCents).toBe(40_000);
  });

  it("clamps invalid bps and truncates cents", () => {
    const result = computeExpectedGrossMargin({
      quotedPriceCents: 10_000.9,
      estimatedGenCents: -5,
      contingencyBps: 50_000,
      channelFeeBps: -10,
    });
    expect(result.channelFeeCents).toBe(0);
    expect(result.genWithContingencyCents).toBe(0);
    expect(result.expectedGrossMarginCents).toBe(10_000);
  });
});

describe("Job Operator approval vocabulary", () => {
  it("exposes job approval action keys", () => {
    expect(STUDIO_JOB_APPROVAL_KEYS).toEqual([
      "job_workflow",
      "job_budget",
      "job_rights",
      "job_delivery",
    ]);
    expect(isStudioJobApprovalKey("job_budget")).toBe(true);
    expect(isStudioJobApprovalKey("campaign_export")).toBe(false);
  });

  it("lists sources and statuses for schema parity", () => {
    expect(STUDIO_JOB_SOURCES).toContain("upwork");
    expect(STUDIO_JOB_SOURCES).toContain("intake");
    expect(STUDIO_JOB_STATUSES).toContain("needs_review");
    expect(STUDIO_JOB_STATUSES).toContain("delivered");
  });
});
