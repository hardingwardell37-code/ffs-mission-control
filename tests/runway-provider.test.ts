import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRunwayPromptText,
  createRunwayProvider,
  DEFAULT_MODEL,
  resolveRatio,
  RUNWAY_PROMPT_MAX_UTF16,
  utf16Length,
} from "../lib/generation/providers/runway";

describe("runway provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RUNWAYML_API_SECRET;
    delete process.env.RUNWAY_API_KEY;
  });

  it("defaults model to gpt_image_2", () => {
    expect(DEFAULT_MODEL).toBe("gpt_image_2");
  });

  it("maps UI aspect 1:1 to 1920:1920 for gpt_image_2 default", () => {
    expect(resolveRatio({ aspect_ratio: "1:1" })).toBe("1920:1920");
    expect(resolveRatio({ ratio: "1:1" })).toBe("1920:1920");
    expect(resolveRatio(undefined)).toBe("1920:1920");
    expect(resolveRatio({ aspect_ratio: "1:1" }, "gen4_image_turbo")).toBe("1080:1080");
  });

  it("utf16Length matches JS string length (UTF-16 code units)", () => {
    expect(utf16Length("abc")).toBe(3);
    expect(utf16Length("🙂")).toBe(2); // surrogate pair
    expect(utf16Length("a".repeat(1000))).toBe(1000);
  });

  it("fails when main prompt exceeds 1000 UTF-16 units (no silent truncate)", () => {
    const long = "x".repeat(RUNWAY_PROMPT_MAX_UTF16 + 1);
    const built = buildRunwayPromptText(long);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.message).toMatch(/1000 UTF-16/);
      expect(built.message).toMatch(/does not silently truncate/i);
    }
  });

  it("accepts prompt at exactly 1000 UTF-16 units", () => {
    const exact = "y".repeat(RUNWAY_PROMPT_MAX_UTF16);
    const built = buildRunwayPromptText(exact);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(utf16Length(built.promptText)).toBe(1000);
      expect(built.omittedNegative).toBe(false);
    }
  });

  it("omits or shortens Avoid append when negative would blow the limit", () => {
    const base = "z".repeat(990);
    const neg = "blurry watermark logo text artifact ".repeat(20);
    const built = buildRunwayPromptText(base, neg);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(utf16Length(built.promptText)).toBeLessThanOrEqual(RUNWAY_PROMPT_MAX_UTF16);
      expect(built.omittedNegative || built.promptText.includes("Avoid:")).toBe(true);
    }
  });

  it("appends short Avoid when under budget", () => {
    const built = buildRunwayPromptText("Hero product still", "blurry, watermark");
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.promptText).toContain("Avoid: blurry, watermark");
      expect(built.omittedNegative).toBe(false);
    }
  });

  it("reports not_configured without secret", async () => {
    const provider = createRunwayProvider();
    expect(provider.isConfigured()).toBe(false);
    const result = await provider.generate({
      jobId: "j1",
      organizationId: "org",
      campaignId: "camp",
      modality: "image",
      provider: "runway",
      prompt: "Original product still",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_configured");
      expect(result.message).toMatch(/RUNWAYML_API_SECRET/);
    }
  });

  it("rejects non-image modality", async () => {
    process.env.RUNWAYML_API_SECRET = "test-secret";
    const provider = createRunwayProvider();
    const result = await provider.generate({
      jobId: "j2",
      organizationId: "org",
      campaignId: "camp",
      modality: "video",
      provider: "runway",
      prompt: "Original motion",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unsupported_modality");
  });

  it("returns provider_error before POST when Gen-4 prompt exceeds 1000 UTF-16", async () => {
    process.env.RUNWAYML_API_SECRET = "test-secret";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = createRunwayProvider();
    const result = await provider.generate({
      jobId: "j-long",
      organizationId: "org",
      campaignId: "camp",
      modality: "image",
      provider: "runway",
      modelName: "gen4_image_turbo",
      prompt: "p".repeat(RUNWAY_PROMPT_MAX_UTF16 + 50),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider_error");
      expect(result.message).toMatch(/1000 UTF-16/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates task with default gpt_image_2 and returns output[0] after SUCCEEDED poll", async () => {
    process.env.RUNWAYML_API_SECRET = "test-secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "task-1", status: "PENDING" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "task-1",
          status: "SUCCEEDED",
          output: ["https://cdn.example/runway.png"],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "setTimeout",
      ((fn: () => void) => {
        fn();
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
    );

    const provider = createRunwayProvider();
    const result = await provider.generate({
      jobId: "j3",
      organizationId: "org",
      campaignId: "camp",
      modality: "image",
      provider: "runway",
      prompt: "Original arena product hero",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.resultUrl).toBe("https://cdn.example/runway.png");
      expect(result.externalJobId).toBe("task-1");
      expect(result.modelName).toBe("gpt_image_2");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const createCall = fetchMock.mock.calls[0];
    expect(createCall[0]).toBe("https://api.dev.runwayml.com/v1/text_to_image");
    expect(createCall[1].headers.Authorization).toBe("Bearer test-secret");
    expect(createCall[1].headers["X-Runway-Version"]).toBe("2024-11-06");
    const body = JSON.parse(createCall[1].body);
    expect(body).toMatchObject({ model: "gpt_image_2", ratio: "1920:1920" });
  });

  it("honors model override via modelName and settings.model", async () => {
    process.env.RUNWAYML_API_SECRET = "test-secret";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "task-2",
          status: "SUCCEEDED",
          output: ["https://cdn.example/muse.png"],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const provider = createRunwayProvider();
    const result = await provider.generate({
      jobId: "j4",
      organizationId: "org",
      campaignId: "camp",
      modality: "image",
      provider: "runway",
      prompt: "Soft product still",
      modelName: "muse_image",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.modelName).toBe("muse_image");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe("muse_image");

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "task-3",
        status: "SUCCEEDED",
        output: ["https://cdn.example/g4.png"],
      }),
    });
    const result2 = await provider.generate({
      jobId: "j5",
      organizationId: "org",
      campaignId: "camp",
      modality: "image",
      provider: "runway",
      prompt: "Full gen4 still",
      settings: { model: "gen4_image" },
    });
    expect(result2.ok).toBe(true);
    if (result2.ok) expect(result2.modelName).toBe("gen4_image");
  });
});
