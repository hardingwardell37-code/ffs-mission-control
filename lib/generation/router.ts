import { createFalMinimaxH3MaxProvider, createFalMinimaxH3Provider } from "./providers/fal-minimax";
import { createGoogleOmniProvider } from "./providers/google-omni";
import { createGrokImagineProvider } from "./providers/grok-imagine";
import { createOpenAiImageProvider } from "./providers/openai-image";
import { createRunwayProvider } from "./providers/runway";
import type {
  EnvAvailability,
  GenerationModality,
  GenerationProvider,
  GenerationProviderId,
  JobRequest,
  JobResult,
} from "./types";
import { readEnvAvailability } from "./types";

const providers = {
  runway: createRunwayProvider,
  grok_imagine: createGrokImagineProvider,
  openai_image: createOpenAiImageProvider,
  google_omni: createGoogleOmniProvider,
  fal_minimax_h3: createFalMinimaxH3Provider,
  fal_minimax_h3_max: createFalMinimaxH3MaxProvider,
} as const;

export type ConcreteProviderId = Exclude<GenerationProviderId, "auto">;

export function getProvider(id: ConcreteProviderId): GenerationProvider {
  return providers[id]();
}

export function listProviders(): GenerationProvider[] {
  return (Object.keys(providers) as ConcreteProviderId[]).map((id) => getProvider(id));
}

/**
 * Auto router:
 * - image → Runway Gen-4 if RUNWAYML_API_SECRET, else Grok Imagine, else OpenAI Image, else Google Omni
 * - video → fal MiniMax H3 if FAL_KEY, else Grok Imagine if XAI_API_KEY, else Google Omni
 * Returns null when no suitable configured provider exists.
 */
export function resolveAutoProvider(
  modality: GenerationModality,
  env: EnvAvailability = readEnvAvailability(),
): ConcreteProviderId | null {
  if (modality === "image") {
    if (env.runway) return "runway";
    if (env.xai) return "grok_imagine";
    if (env.openai) return "openai_image";
    if (env.googleOmni) return "google_omni";
    return null;
  }
  if (modality === "video") {
    if (env.fal) return "fal_minimax_h3";
    if (env.xai) return "grok_imagine";
    if (env.googleOmni) return "google_omni";
    return null;
  }
  return null;
}

export function resolveProviderId(
  requested: GenerationProviderId,
  modality: GenerationModality,
  env: EnvAvailability = readEnvAvailability(),
): ConcreteProviderId | null {
  if (requested === "auto") return resolveAutoProvider(modality, env);
  return requested;
}

export async function runGenerationRequest(
  request: Omit<JobRequest, "provider"> & { provider: GenerationProviderId },
  env: EnvAvailability = readEnvAvailability(),
): Promise<JobResult & { resolvedProvider?: ConcreteProviderId }> {
  const resolved = resolveProviderId(request.provider, request.modality, env);
  if (!resolved) {
    return {
      ok: false,
      provider: "auto",
      code: "not_configured",
      message:
        request.modality === "image"
          ? "No image provider is configured. Set RUNWAYML_API_SECRET, XAI_API_KEY, OPENAI_API_KEY, or GOOGLE_OMNI_API_KEY on the server."
          : "No video provider is configured. Set FAL_KEY or XAI_API_KEY on the server.",
    };
  }

  const provider = getProvider(resolved);
  if (!provider.supportedModalities.includes(request.modality)) {
    return {
      ok: false,
      provider: resolved,
      code: "unsupported_modality",
      message: `${provider.displayName} does not support ${request.modality}.`,
      resolvedProvider: resolved,
    };
  }

  // Providers return detailed not_configured messages (env key names) when keys are missing.
  const result = await provider.generate({ ...request, provider: resolved });
  return { ...result, resolvedProvider: resolved };
}
