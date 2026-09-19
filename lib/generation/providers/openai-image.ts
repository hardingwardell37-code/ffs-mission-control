import type { CreateGenerationProvider, JobRequest, JobResult } from "../types";

const DEFAULT_MODEL = "gpt-image-1";

export const createOpenAiImageProvider: CreateGenerationProvider = () => {
  const id = "openai_image" as const;
  return {
    id,
    displayName: "OpenAI Image",
    supportedModalities: ["image"],
    isConfigured() {
      return Boolean(process.env.OPENAI_API_KEY?.trim());
    },
    async generate(request: JobRequest): Promise<JobResult> {
      if (request.modality !== "image") {
        return {
          ok: false,
          provider: id,
          code: "unsupported_modality",
          message: "OpenAI Image provider only supports image modality.",
        };
      }
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      if (!apiKey) {
        return {
          ok: false,
          provider: id,
          code: "not_configured",
          message: "OPENAI_API_KEY is not set. Add it on the server (Netlify env) to enable image generation.",
        };
      }

      const model = request.modelName?.trim() || DEFAULT_MODEL;
      const size =
        typeof request.settings?.size === "string" ? request.settings.size : "1024x1024";

      try {
        const body: Record<string, unknown> = {
          model,
          prompt: request.prompt,
          n: 1,
          size,
        };
        if (request.negativePrompt?.trim()) {
          body.prompt = `${request.prompt}\n\nAvoid: ${request.negativePrompt.trim()}`;
        }

        const res = await fetch("https://api.openai.com/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
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
            message: payload.error?.message || `OpenAI Images API returned ${res.status}`,
            metadata: { status: res.status },
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
          message: "OpenAI Images API returned no image data.",
        };
      } catch (err) {
        return {
          ok: false,
          provider: id,
          code: "provider_error",
          message: err instanceof Error ? err.message : "OpenAI request failed",
        };
      }
    },
  };
};
