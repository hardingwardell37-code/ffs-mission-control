import type {
  CreateGenerationProvider,
  GenerationProviderId,
  JobRequest,
  JobResult,
} from "../types";

/** Studio H3 → fal MiniMax Hailuo standard; H3 Max → pro. */
const MODEL_PATHS: Record<"fal_minimax_h3" | "fal_minimax_h3_max", string> = {
  fal_minimax_h3: "fal-ai/minimax/hailuo-2.3/standard/text-to-video",
  fal_minimax_h3_max: "fal-ai/minimax/hailuo-2.3/pro/text-to-video",
};

function createFalProvider(
  providerId: "fal_minimax_h3" | "fal_minimax_h3_max",
  displayName: string,
): ReturnType<CreateGenerationProvider> {
  return {
    id: providerId,
    displayName,
    supportedModalities: ["video"],
    isConfigured() {
      return Boolean(process.env.FAL_KEY?.trim());
    },
    async generate(request: JobRequest): Promise<JobResult> {
      if (request.modality !== "video") {
        return {
          ok: false,
          provider: providerId,
          code: "unsupported_modality",
          message: `${displayName} only supports video modality.`,
        };
      }
      const apiKey = process.env.FAL_KEY?.trim();
      if (!apiKey) {
        return {
          ok: false,
          provider: providerId,
          code: "not_configured",
          message: "FAL_KEY is not set. Add it on the server (Netlify env) to enable MiniMax video generation.",
        };
      }

      const modelPath =
        (typeof request.modelName === "string" && request.modelName.includes("/"))
          ? request.modelName
          : MODEL_PATHS[providerId];

      const input: Record<string, unknown> = {
        prompt: request.prompt,
      };
      if (request.negativePrompt?.trim()) {
        input.prompt = `${request.prompt}\n\nAvoid: ${request.negativePrompt.trim()}`;
      }
      const refUrl = request.referenceUrls?.find(Boolean);
      if (refUrl) {
        input.image_url = refUrl;
      }

      try {
        const submitRes = await fetch(`https://queue.fal.run/${modelPath}`, {
          method: "POST",
          headers: {
            Authorization: `Key ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        });

        const submitBody = (await submitRes.json().catch(() => ({}))) as {
          request_id?: string;
          status?: string;
          detail?: string;
          error?: string;
          video?: { url?: string };
          response_url?: string;
          status_url?: string;
        };

        if (!submitRes.ok) {
          return {
            ok: false,
            provider: providerId,
            code: "provider_error",
            message:
              submitBody.detail ||
              submitBody.error ||
              `fal queue submit returned ${submitRes.status}`,
            metadata: { status: submitRes.status, modelPath },
          };
        }

        const requestId = submitBody.request_id;
        if (!requestId) {
          // Some sync-style responses may include video immediately
          if (submitBody.video?.url) {
            return {
              ok: true,
              provider: providerId,
              modelName: modelPath,
              resultUrl: submitBody.video.url,
              mimeType: "video/mp4",
              externalJobId: null,
            };
          }
          return {
            ok: false,
            provider: providerId,
            code: "provider_error",
            message: "fal queue did not return a request_id.",
            metadata: { modelPath },
          };
        }

        // Poll status briefly (scaffolding — production may use webhooks).
        const statusUrl =
          submitBody.status_url ||
          `https://queue.fal.run/${modelPath}/requests/${requestId}/status`;
        const resultUrl =
          submitBody.response_url ||
          `https://queue.fal.run/${modelPath}/requests/${requestId}`;

        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 2500));
          const stRes = await fetch(statusUrl, {
            headers: { Authorization: `Key ${apiKey}` },
          });
          const st = (await stRes.json().catch(() => ({}))) as {
            status?: string;
            detail?: string;
          };
          if (st.status === "COMPLETED" || st.status === "OK") {
            const outRes = await fetch(resultUrl, {
              headers: { Authorization: `Key ${apiKey}` },
            });
            const out = (await outRes.json().catch(() => ({}))) as {
              video?: { url?: string };
              detail?: string;
            };
            if (out.video?.url) {
              return {
                ok: true,
                provider: providerId,
                modelName: modelPath,
                resultUrl: out.video.url,
                mimeType: "video/mp4",
                externalJobId: requestId,
              };
            }
            return {
              ok: false,
              provider: providerId,
              code: "provider_error",
              message: out.detail || "fal completed without a video URL.",
              externalJobId: requestId,
            };
          }
          if (st.status === "FAILED" || st.status === "ERROR") {
            return {
              ok: false,
              provider: providerId,
              code: "provider_error",
              message: st.detail || "fal job failed.",
              externalJobId: requestId,
            };
          }
        }

        return {
          ok: false,
          provider: providerId,
          code: "provider_error",
          message:
            "fal job is still running after the sync wait window. Check fal dashboard with the external job id, or re-run later.",
          externalJobId: requestId,
          metadata: { modelPath, note: "async_pending" },
        };
      } catch (err) {
        return {
          ok: false,
          provider: providerId,
          code: "provider_error",
          message: err instanceof Error ? err.message : "fal request failed",
        };
      }
    },
  };
}

export const createFalMinimaxH3Provider: CreateGenerationProvider = () =>
  createFalProvider("fal_minimax_h3", "fal MiniMax H3");

export const createFalMinimaxH3MaxProvider: CreateGenerationProvider = () =>
  createFalProvider("fal_minimax_h3_max", "fal MiniMax H3 Max");

export function resolveFalModelPath(
  provider: Extract<GenerationProviderId, "fal_minimax_h3" | "fal_minimax_h3_max">,
): string {
  return MODEL_PATHS[provider];
}
