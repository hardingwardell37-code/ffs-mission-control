import { describe, expect, it } from "vitest";
import {
  resolveAutoProvider,
  resolveProviderId,
  runGenerationRequest,
} from "../lib/generation/router";
import type { EnvAvailability } from "../lib/generation/types";

const emptyEnv: EnvAvailability = { openai: false, googleOmni: false, fal: false, xai: false };

describe("generation auto router", () => {
  it("prefers Grok Imagine for images when XAI_API_KEY is available", () => {
    const env: EnvAvailability = { openai: true, googleOmni: true, fal: true, xai: true };
    expect(resolveAutoProvider("image", env)).toBe("grok_imagine");
  });

  it("falls back to OpenAI for images without xAI", () => {
    const env: EnvAvailability = { openai: true, googleOmni: true, fal: true, xai: false };
    expect(resolveAutoProvider("image", env)).toBe("openai_image");
  });

  it("falls back to Google Omni for images without OpenAI or xAI", () => {
    const env: EnvAvailability = { openai: false, googleOmni: true, fal: true, xai: false };
    expect(resolveAutoProvider("image", env)).toBe("google_omni");
  });

  it("returns null for images when no image keys exist", () => {
    const env: EnvAvailability = { openai: false, googleOmni: false, fal: true, xai: false };
    expect(resolveAutoProvider("image", env)).toBeNull();
  });

  it("prefers fal MiniMax H3 for video when FAL_KEY is present", () => {
    const env: EnvAvailability = { openai: true, googleOmni: true, fal: true, xai: true };
    expect(resolveAutoProvider("video", env)).toBe("fal_minimax_h3");
  });

  it("falls back to Grok Imagine for video without fal", () => {
    const env: EnvAvailability = { openai: true, googleOmni: true, fal: false, xai: true };
    expect(resolveAutoProvider("video", env)).toBe("grok_imagine");
  });

  it("falls back to Google Omni for video without fal or xAI", () => {
    const env: EnvAvailability = { openai: true, googleOmni: true, fal: false, xai: false };
    expect(resolveAutoProvider("video", env)).toBe("google_omni");
  });

  it("resolves explicit providers without rewriting", () => {
    expect(resolveProviderId("openai_image", "image")).toBe("openai_image");
    expect(resolveProviderId("grok_imagine", "image")).toBe("grok_imagine");
    expect(resolveProviderId("fal_minimax_h3_max", "video")).toBe("fal_minimax_h3_max");
  });
});

describe("generation missing keys", () => {
  it("returns not_configured for auto image with empty env", async () => {
    const result = await runGenerationRequest(
      {
        jobId: "00000000-0000-0000-0000-000000000001",
        organizationId: "org",
        campaignId: "camp",
        modality: "image",
        provider: "auto",
        prompt: "Original arena lighting on brushed steel product",
      },
      emptyEnv,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_configured");
      expect(result.message).toMatch(/XAI_API_KEY|OPENAI_API_KEY|GOOGLE_OMNI/i);
    }
  });

  it("returns not_configured when explicit provider key is missing", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      const result = await runGenerationRequest(
        {
          jobId: "00000000-0000-0000-0000-000000000002",
          organizationId: "org",
          campaignId: "camp",
          modality: "image",
          provider: "openai_image",
          prompt: "Original still life",
        },
        emptyEnv,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("not_configured");
        expect(result.provider).toBe("openai_image");
      }
    } finally {
      if (prev !== undefined) process.env.OPENAI_API_KEY = prev;
    }
  });

  it("returns not_configured for Grok Imagine without XAI_API_KEY", async () => {
    const prev = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      const result = await runGenerationRequest(
        {
          jobId: "00000000-0000-0000-0000-000000000004",
          organizationId: "org",
          campaignId: "camp",
          modality: "image",
          provider: "grok_imagine",
          prompt: "Original product hero on slate",
        },
        emptyEnv,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("not_configured");
        expect(result.message).toMatch(/XAI_API_KEY/);
        expect(result.provider).toBe("grok_imagine");
      }
    } finally {
      if (prev !== undefined) process.env.XAI_API_KEY = prev;
    }
  });

  it("returns not_configured for fal without FAL_KEY", async () => {
    const prev = process.env.FAL_KEY;
    delete process.env.FAL_KEY;
    try {
      const result = await runGenerationRequest(
        {
          jobId: "00000000-0000-0000-0000-000000000003",
          organizationId: "org",
          campaignId: "camp",
          modality: "video",
          provider: "fal_minimax_h3",
          prompt: "Original tracking shot through a warehouse",
        },
        emptyEnv,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("not_configured");
        expect(result.message).toMatch(/FAL_KEY/);
      }
    } finally {
      if (prev !== undefined) process.env.FAL_KEY = prev;
    }
  });
});
