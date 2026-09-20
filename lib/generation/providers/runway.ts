import type { CreateGenerationProvider, JobRequest, JobResult } from "../types";

const RUNWAY_BASE = "https://api.dev.runwayml.com";
const RUNWAY_VERSION = "2024-11-06";
/** Wardell default: GPT Image 2 via Runway (1–41 credits by quality/resolution). */
export const DEFAULT_MODEL = "gpt_image_2";
/** Gen-4 family 1:1 default. */
const DEFAULT_RATIO_GEN4 = "1080:1080";
/** GPT Image 2 1:1 (1080:1080 not in gpt_image_2 ratio enum). */
const DEFAULT_RATIO_GPT = "1920:1920";
/** Gen-4 / muse promptText max (UTF-16). GPT Image 2 allows up to 32000. */
export const RUNWAY_PROMPT_MAX_UTF16 = 1000;
export const RUNWAY_PROMPT_MAX_UTF16_GPT_IMAGE_2 = 32000;

const KNOWN_MODELS = new Set([
  "gpt_image_2",
  "gen4_image_turbo",
  "gen4_image",
  "muse_image",
]);

const GEN4_RATIOS = new Set([
  "1080:1080",
  "1920:1080",
  "1080:1920",
  "1440:1080",
  "1080:1440",
  "1024:1024",
  "720:720",
]);

const GPT_IMAGE_2_RATIOS = new Set([
  "1920:1920",
  "2560:2560",
  "2880:2880",
  "1920:1088",
  "1088:1920",
  "1920:1280",
  "1280:1920",
  "auto",
]);

/** JS string.length counts UTF-16 code units (what Runway validates). */
export function utf16Length(text: string): number {
  return text.length;
}

function resolveModel(request: JobRequest): string {
  const fromSettings =
    typeof request.settings?.model === "string" ? request.settings.model.trim() : "";
  const fromRequest = request.modelName?.trim() || "";
  const raw = fromSettings || fromRequest;
  if (!raw) return DEFAULT_MODEL;
  if (KNOWN_MODELS.has(raw)) return raw;
  // Pass through only safe model id shapes (lowercase alnum + underscore / hyphen).
  if (/^[a-z][a-z0-9_-]{0,63}$/i.test(raw)) return raw;
  return DEFAULT_MODEL;
}

export function promptLimitForModel(model: string): number {
  return model === "gpt_image_2" ? RUNWAY_PROMPT_MAX_UTF16_GPT_IMAGE_2 : RUNWAY_PROMPT_MAX_UTF16;
}

/** Map common aspect settings to model-valid Runway ratios. */
export function resolveRatio(settings?: Record<string, unknown>, model: string = DEFAULT_MODEL): string {
  const raw =
    (typeof settings?.ratio === "string" && settings.ratio) ||
    (typeof settings?.aspect_ratio === "string" && settings.aspect_ratio) ||
    "";
  const normalized = raw.trim().toLowerCase().replace(/x/g, ":");
  const isGpt = model === "gpt_image_2";
  const fallback = isGpt ? DEFAULT_RATIO_GPT : DEFAULT_RATIO_GEN4;
  const allowed = isGpt ? GPT_IMAGE_2_RATIOS : GEN4_RATIOS;

  const map: Record<string, string> = isGpt
    ? {
        "1:1": "1920:1920",
        "1920:1920": "1920:1920",
        "1080:1080": "1920:1920",
        "1024:1024": "1920:1920",
        "16:9": "1920:1088",
        "9:16": "1088:1920",
        auto: "auto",
      }
    : {
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

  if (!normalized) return fallback;
  const mapped = map[normalized] || (allowed.has(normalized) ? normalized : fallback);
  return allowed.has(mapped) ? mapped : fallback;
}

/**
 * Build promptText under Runway's UTF-16 limit.
 * Main prompt over limit → fail (no silent mid-word truncate).
 * Negatives append as short "Avoid: …" only when they fit; else omit / shorten at word boundary.
 */
export function buildRunwayPromptText(
  prompt: string,
  negativePrompt?: string,
  maxUtf16: number = RUNWAY_PROMPT_MAX_UTF16,
): { ok: true; promptText: string; omittedNegative: boolean } | { ok: false; message: string } {
  const base = prompt;
  const baseLen = utf16Length(base);
  if (baseLen > maxUtf16) {
    return {
      ok: false,
      message:
        `Runway promptText max is ${maxUtf16} UTF-16 code units; got ${baseLen}. ` +
        `Rewrite a shorter prompt (Prompt Engineer) — the API rejects longer text with "Validation of body failed". ` +
        `This integration does not silently truncate the main prompt.`,
    };
  }

  const neg = negativePrompt?.trim();
  if (!neg) {
    return { ok: true, promptText: base, omittedNegative: false };
  }

  const avoidPrefix = "\n\nAvoid: ";
  const budget = maxUtf16 - baseLen - utf16Length(avoidPrefix);
  if (budget <= 0) {
    return { ok: true, promptText: base, omittedNegative: true };
  }

  if (utf16Length(neg) <= budget) {
    return { ok: true, promptText: `${base}${avoidPrefix}${neg}`, omittedNegative: false };
  }

  const shortened = shortenAtWordBoundary(neg, budget);
  if (!shortened) {
    return { ok: true, promptText: base, omittedNegative: true };
  }
  return {
    ok: true,
    promptText: `${base}${avoidPrefix}${shortened}`,
    omittedNegative: true,
  };
}

/** Shorten to ≤ max UTF-16 units at a word boundary; empty if nothing fits. */
function shortenAtWordBoundary(text: string, maxUnits: number): string {
  if (maxUnits <= 0) return "";
  if (utf16Length(text) <= maxUnits) return text;
  const slice = text.slice(0, maxUnits);
  const lastSpace = slice.lastIndexOf(" ");
  const cut = lastSpace > Math.floor(maxUnits * 0.4) ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd();
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
  const model = resolveModel(request);
  const limit = promptLimitForModel(model);
  const built = buildRunwayPromptText(request.prompt, request.negativePrompt, limit);
  if (!built.ok) {
    return {
      ok: false,
      provider: id,
      code: "provider_error",
      message: built.message,
      metadata: { model, promptUtf16: utf16Length(request.prompt), limit },
    };
  }
  const { promptText, omittedNegative } = built;
  const ratio = resolveRatio(request.settings, model);

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
      metadata: {
        status: submitRes.status,
        model,
        ratio,
        promptUtf16: utf16Length(promptText),
        omittedNegative,
      },
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
      metadata: { ratio, omittedNegative },
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
          metadata: { ratio, omittedNegative },
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
    displayName: "Runway Image",
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
            "RUNWAYML_API_SECRET is not set. Add it on the server (Netlify env) to enable Runway image generation.",
        };
      }

      try {
        if (request.modality === "image") return await generateImage(request, secret);
        return {
          ok: false,
          provider: id,
          code: "unsupported_modality",
          message: "Runway supports image modality only in this integration.",
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

function apiSecret(): string | undefined {
  return (
    process.env.RUNWAYML_API_SECRET?.trim() ||
    process.env.RUNWAY_API_KEY?.trim() ||
    undefined
  );
}
