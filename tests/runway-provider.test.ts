import { afterEach, describe, expect, it, vi } from "vitest";
import { createRunwayProvider } from "../lib/generation/providers/runway";

describe("runway provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RUNWAYML_API_SECRET;
    delete process.env.RUNWAY_API_KEY;
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

  it("creates task and returns output[0] after SUCCEEDED poll", async () => {
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
      expect(result.modelName).toBe("gen4_image");
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const createCall = fetchMock.mock.calls[0];
    expect(createCall[0]).toBe("https://api.dev.runwayml.com/v1/text_to_image");
    expect(createCall[1].headers.Authorization).toBe("Bearer test-secret");
    expect(createCall[1].headers["X-Runway-Version"]).toBe("2024-11-06");
    const body = JSON.parse(createCall[1].body);
    expect(body).toMatchObject({ model: "gen4_image", ratio: "1080:1080" });
  });
});
