import type { CreateGenerationProvider, JobRequest, JobResult } from "../types";

const DEFAULT_IMAGE_MODEL = "grok-imagine-image";
const DEFAULT_VIDEO_MODEL = "grok-imagine-video";
const XAI_BASE = "https://api.x.ai/v1";

function apiKey(): string | undefined {
  return process.env.XAI_API_KEY?.trim() || undefined;
}

async function generateImage(request: JobRequest, key: string): Promise<JobResult> {
  const id = "grok_imagine" as const;
  const model = request.modelName?.trim() || DEFAULT_IMAGE_MODEL;
  let prompt = request.prompt;
  if (request.negativePrompt?.trim()) {
    prompt = `${prompt}\n\nAvoid: ${request.negativePrompt.trim()}`;
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
  };
  if (typeof request.settings?.aspect_ratio === "string") {
    body.aspect_ratio = request.settings.aspect_ratio;
  }

  const res = await fetch(`${XAI_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    data?: Array<{ url?: string; b64_json?: string }>;
    error?: { message?: string };
    id?: string;
  };

  if (!res.ok) {
    return {
      ok: false,
      provider: id,
      code: "provider_error",
      message: payload.error?.message || `xAI Images API returned ${res.status}`,
      metadata: { status: res.status, model },
    };
  }

  const first = payload.data?.[0];
  if (first?.url) {
    return {
      ok: true,
      provider: id,
      modelName: model,
      resultUrl: first.url,
      mimeType: "image/png",
      externalJobId: payload.id ?? null,
    };
  }
  if (first?.b64_json) {
    const raw = Buffer.from(first.b64_json, "base64");
    return {
      ok: true,
      provider: id,
      modelName: model,
      resultBytes: new Uint8Array(raw),
      mimeType: "image/png",
      externalJobId: payload.id ?? null,
    };
  }

  return {
    ok: false,
    provider: id,
    code: "provider_error",
    message: "xAI Images API returned no image data.",
    metadata: { model },
  };
}

async function generateVideo(request: JobRequest, key: string): Promise<JobResult> {
  const id = "grok_imagine" as const;
  const model = request.modelName?.trim() || DEFAULT_VIDEO_MODEL;
  let prompt = request.prompt;
  if (request.negativePrompt?.trim()) {
    prompt = `${prompt}\n\nAvoid: ${request.negativePrompt.trim()}`;
  }

  const body: Record<string, unknown> = {
    model,
    prompt,
  };
  const refUrl = request.referenceUrls?.find(Boolean);
  if (refUrl) {
    body.image = { url: refUrl };
  }
  if (typeof request.settings?.duration === "number") {
    body.duration = request.settings.duration;
  } else if (typeof request.settings?.duration === "string") {
    const n = Number(request.settings.duration);
    if (Number.isFinite(n)) body.duration = n;
  }
  if (typeof request.settings?.aspect_ratio === "string") {
    body.aspect_ratio = request.settings.aspect_ratio;
  }
  if (typeof request.settings?.resolution === "string") {
    body.resolution = request.settings.resolution;
  }

  const submitRes = await fetch(`${XAI_BASE}/videos/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const submitBody = (await submitRes.json().catch(() => ({}))) as {
    request_id?: string;
    status?: string;
    video?: { url?: string };
    error?: { message?: string };
    message?: string;
  };

  if (!submitRes.ok) {
    return {
      ok: false,
      provider: id,
      code: "provider_error",
      message:
        submitBody.error?.message ||
        submitBody.message ||
        `xAI Videos API returned ${submitRes.status}`,
      metadata: { status: submitRes.status, model },
    };
  }

  // Sync-style response
  if (submitBody.video?.url) {
    return {
      ok: true,
      provider: id,
      modelName: model,
      resultUrl: submitBody.video.url,
      mimeType: "video/mp4",
      externalJobId: submitBody.request_id ?? null,
    };
  }

  const requestId = submitBody.request_id;
  if (!requestId) {
    return {
      ok: false,
      provider: id,
      code: "provider_error",
      message: "xAI Videos API did not return a request_id or video URL.",
      metadata: { model },
    };
  }

  // Poll briefly (scaffolding — production may use webhooks / longer workers).
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const stRes = await fetch(`${XAI_BASE}/videos/${requestId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const st = (await stRes.json().catch(() => ({}))) as {
      status?: string;
      video?: { url?: string };
      error?: { message?: string };
      message?: string;
    };
    if (st.status === "done" || st.status === "completed") {
      if (st.video?.url) {
        return {
          ok: true,
          provider: id,
          modelName: model,
          resultUrl: st.video.url,
          mimeType: "video/mp4",
          externalJobId: requestId,
        };
      }
      return {
        ok: false,
        provider: id,
        code: "provider_error",
        message: st.error?.message || "xAI video completed without a URL.",
        externalJobId: requestId,
      };
    }
    if (st.status === "failed" || st.status === "expired") {
      return {
        ok: false,
        provider: id,
        code: "provider_error",
        message: st.error?.message || st.message || `xAI video job ${st.status}.`,
        externalJobId: requestId,
      };
    }
  }

  return {
    ok: false,
    provider: id,
    code: "provider_error",
    message:
      "xAI video job is still running after the sync wait window. Check the xAI console with the external job id, or re-run later.",
    externalJobId: requestId,
    metadata: { model, note: "async_pending" },
  };
}

export const createGrokImagineProvider: CreateGenerationProvider = () => {
  const id = "grok_imagine" as const;
  return {
    id,
    displayName: "Grok Imagine",
    supportedModalities: ["image", "video"],
    isConfigured() {
      return Boolean(apiKey());
    },
    async generate(request: JobRequest): Promise<JobResult> {
      const key = apiKey();
      if (!key) {
        return {
          ok: false,
          provider: id,
          code: "not_configured",
          message:
            "XAI_API_KEY is not set. Add it on the server (Netlify env) to enable Grok Imagine generation.",
        };
      }

      try {
        if (request.modality === "image") return await generateImage(request, key);
        if (request.modality === "video") return await generateVideo(request, key);
        return {
          ok: false,
          provider: id,
          code: "unsupported_modality",
          message: "Grok Imagine supports image and video modalities only.",
        };
      } catch (err) {
        return {
          ok: false,
          provider: id,
          code: "provider_error",
          message: err instanceof Error ? err.message : "Grok Imagine request failed",
        };
      }
    },
  };
};
