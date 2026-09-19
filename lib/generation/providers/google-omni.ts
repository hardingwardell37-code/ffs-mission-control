import type { CreateGenerationProvider, JobRequest, JobResult } from "../types";

/**
 * Google Omni / Gemini multimodal scaffolding.
 * Env: GOOGLE_OMNI_API_KEY (preferred), or GOOGLE_API_KEY / GEMINI_API_KEY.
 * Real calls use Gemini image generation when a key is present; otherwise not_configured.
 */
const DEFAULT_MODEL = "gemini-2.0-flash-preview-image-generation";

function resolveApiKey(): string | undefined {
  return (
    process.env.GOOGLE_OMNI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    undefined
  );
}

export const createGoogleOmniProvider: CreateGenerationProvider = () => {
  const id = "google_omni" as const;
  return {
    id,
    displayName: "Google Omni",
    supportedModalities: ["image", "video"],
    isConfigured() {
      return Boolean(resolveApiKey());
    },
    async generate(request: JobRequest): Promise<JobResult> {
      const apiKey = resolveApiKey();
      if (!apiKey) {
        return {
          ok: false,
          provider: id,
          code: "not_configured",
          message:
            "GOOGLE_OMNI_API_KEY (or GOOGLE_API_KEY / GEMINI_API_KEY) is not set. Add a server-side key to enable Omni generation.",
        };
      }

      if (request.modality === "video") {
        return {
          ok: false,
          provider: id,
          code: "unsupported_modality",
          message:
            "Google Omni video generation is scaffolded but not wired yet. Use fal MiniMax H3 for video, or wait for Phase 2.1.",
        };
      }

      const model = request.modelName?.trim() || DEFAULT_MODEL;
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      try {
        const promptParts = [request.prompt];
        if (request.negativePrompt?.trim()) {
          promptParts.push(`Avoid: ${request.negativePrompt.trim()}`);
        }
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: promptParts.join("\n\n") }] }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
            },
          }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          candidates?: Array<{
            content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string }; text?: string }> };
          }>;
          error?: { message?: string };
        };

        if (!res.ok) {
          return {
            ok: false,
            provider: id,
            code: "provider_error",
            message: payload.error?.message || `Google Omni API returned ${res.status}`,
            metadata: { status: res.status, model },
          };
        }

        const parts = payload.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find((p) => p.inlineData?.data);
        if (imagePart?.inlineData?.data) {
          const raw = Buffer.from(imagePart.inlineData.data, "base64");
          return {
            ok: true,
            provider: id,
            modelName: model,
            resultBytes: new Uint8Array(raw),
            mimeType: imagePart.inlineData.mimeType || "image/png",
          };
        }

        const text = parts.map((p) => p.text).filter(Boolean).join(" ").trim();
        return {
          ok: false,
          provider: id,
          code: "provider_error",
          message: text
            ? `Omni returned text without image: ${text.slice(0, 240)}`
            : "Google Omni returned no image payload.",
          metadata: { model },
        };
      } catch (err) {
        return {
          ok: false,
          provider: id,
          code: "provider_error",
          message: err instanceof Error ? err.message : "Google Omni request failed",
        };
      }
    },
  };
};
