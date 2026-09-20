import type { CreateGenerationProvider, JobRequest, JobResult } from "../types";

const RUNWAY_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";
const DEFAULT_MODEL = "gen4_image";
const DEFAULT_RATIO = "1080:1080";

function apiSecret(): string | undefined {
  return (
    process.env.RUNWAYML_API_SECRET?.trim() ||
    process.env.RUNWAY_API_KEY?.trim() ||
    undefined
  );
}

/** Map common aspect settings to Runway Gen-4 Image ratios. Prefer documented 1080:1080 for 1:1. */
function resolveRatio(settings?: Record<string, unknown>): string {
  const raw =
    (typeof settings?.ratio === "string" && settings.ratio) ||
    (typeof settings?.aspect_ratio === "string" && settings.aspect_ratio) ||
    "";
  const normalized = raw.trim().toLowerCase().replace(/x/g, ":");
  if (!normalized) return DEFAULT_RATIO;

  const map: Record<string, string> = {
    "1:1": "1080:1080",
    "1080:1080": "1080:1080",
    "1024:1024": "1080:1080",
    "16:9": "1920:1080",
    "1920:1080": "1920:1080",
    "9:16": "1080:1920",
    "1080:1920": "1080:1920",
    "4:3": "1440:1080",
    "1440:1080": "1440:1080",
    "3:4": "1080:1440",
    "1080:1440": "1080:1440",
  };
  return map[normalized] || DEFAULT_RATIO;
}

function authHeaders(secret: string): HeadersInit {
  return {
    Authorization: `Bearer ${secret}`,
    "X-Runway-Version": RUNWAY_VERSION,
    "Content-Type": "application/json",
  };
}

async function generateImage(request: JobRequest, secret: string): Promise<JobResult> {
  const id = "runway" as const;
  const model = request.modelName?.trim() || DEFAULT_MODEL;
  let promptText = request.prompt;
  if (request.negativePrompt?.trim()) {
    promptText = `${promptText}\n\nAvoid: ${request.negativePrompt.trim()}`;
  }
  const ratio = resolveRatio(request.settings);

  const submitRes = await fetch(`${RUNWAY_BASE}/v1/text_to_image`, {
    method: "POST",
    headers: authHeaders(secret),
    body: JSON.stringify({
      model,
      promptText,
      ratio,
    }),
  });

  const submitBody = (await submitRes.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    output?: string[];
    error?: string | { message?: string };
    failure?: string;
    failureCode?: string;
  };

  if (!submitRes.ok) {
    const errMsg =
      (typeof submitBody.error === "string" && submitBody.error) ||
      (typeof submitBody.error === "object" && submitBody.error?.message) ||
      submitBody.failure ||
      `Runway text_to_image returned ${submitRes.status}`;
    return {
      ok: false,
      provider: id,
      code: "provider_error",
      message: errMsg,
      metadata: { status: submitRes.status, model, ratio },
    };
  }

  // Rare sync-style success
  if (submitBody.status === "SUCCEEDED" && submitBody.output?.[0]) {
    return {
      ok: true,
      provider: id,
      modelName: model,
      resultUrl: submitBody.output[0],
      mimeType: "image/png",
      externalJobId: submitBody.id ?? null,
      metadata: { ratio },
    };
  }

  const taskId = submitBody.id;
  if (!taskId) {
    return {
      ok: false,
      provider: id,
      code: "provider_error",
      message: "Runway text_to_image did not return a task id.",
      metadata: { model, ratio },
    };
  }

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2500));
    const stRes = await fetch(`${RUNWAY_BASE}/v1/tasks/${taskId}`, {
      headers: {
        Authorization: `Bearer ${secret}`,
        "X-Runway-Version": RUNWAY_VERSION,
      },
    });
    const st = (await stRes.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      output?: string[];
      error?: string | { message?: string };
      failure?: string;
      failureCode?: string;
    };

    if (!stRes.ok) {
      return {
        ok: false,
        provider: id,
        code: "provider_error",
        message:
          (typeof st.error === "string" && st.error) ||
          (typeof st.error === "object" && st.error?.message) ||
          `Runway task poll returned ${stRes.status}`,
        externalJobId: taskId,
        metadata: { status: stRes.status, model },
      };
    }

    const status = (st.status || "").toUpperCase();
    if (status === "SUCCEEDED") {
      const resultUrl = st.output?.[0];
      if (resultUrl) {
        return {
          ok: true,
          provider: id,
          modelName: model,
          resultUrl,
          mimeType: "image/png",
          externalJobId: taskId,
          metadata: { ratio },
        };
      }
      return {
        ok: false,
        provider: id,
        code: "provider_error",
        message: "Runway task succeeded without an output URL.",
        externalJobId: taskId,
        metadata: { model, ratio },
      };
    }
    if (status === "FAILED" || status === "CANCELLED") {
      const errMsg =
        st.failure ||
        (typeof st.error === "string" && st.error) ||
        (typeof st.error === "object" && st.error?.message) ||
        `Runway task ${status.toLowerCase()}.`;
      return {
        ok: false,
        provider: id,
        code: "provider_error",
        message: errMsg,
        externalJobId: taskId,
        metadata: { failureCode: st.failureCode, model },
      };
    }
  }

  return {
    ok: false,
    provider: id,
    code: "provider_error",
    message:
      "Runway image job is still running after the sync wait window. Check the Runway dashboard with the external job id, or re-run later.",
    externalJobId: taskId,
    metadata: { model, ratio, note: "async_pending" },
  };
}

export const createRunwayProvider: CreateGenerationProvider = () => {
  const id = "runway" as const;
  return {
    id,
    displayName: "Runway Gen-4 Image",
    supportedModalities: ["image"],
    isConfigured() {
      return Boolean(apiSecret());
    },
    async generate(request: JobRequest): Promise<JobResult> {
      const secret = apiSecret();
      if (!secret) {
        return {
          ok: false,
          provider: id,
          code: "not_configured",
          message:
            "RUNWAYML_API_SECRET is not set. Add it on the server (Netlify env) to enable Runway Gen-4 Image generation.",
        };
      }

      try {
        if (request.modality === "image") return await generateImage(request, secret);
        return {
          ok: false,
          provider: id,
          code: "unsupported_modality",
          message: "Runway Gen-4 Image supports image modality only in this integration.",
        };
      } catch (err) {
        return {
          ok: false,
          provider: id,
          code: "provider_error",
          message: err instanceof Error ? err.message : "Runway request failed",
        };
      }
    },
  };
};
