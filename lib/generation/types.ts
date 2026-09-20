/** Generation provider interface — adapters only; never hard-wire models in campaign logic. */

export type GenerationProviderId =
  | "openai_image"
  | "google_omni"
  | "fal_minimax_h3"
  | "fal_minimax_h3_max"
  | "grok_imagine"
  | "runway"
  | "auto";

export type GenerationModality = "image" | "video";

export type GenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export type ProviderFailureCode =
  | "not_configured"
  | "unsupported_modality"
  | "provider_error"
  | "invalid_request";

export interface JobRequest {
  jobId: string;
  organizationId: string;
  campaignId: string;
  modality: GenerationModality;
  provider: Exclude<GenerationProviderId, "auto">;
  modelName?: string | null;
  prompt: string;
  negativePrompt?: string;
  settings?: Record<string, unknown>;
  referenceAssetIds?: string[];
  lockedAssetIds?: string[];
  /** Optional URLs for reference imagery when available (server-resolved). */
  referenceUrls?: string[];
}

export interface JobResultSuccess {
  ok: true;
  provider: Exclude<GenerationProviderId, "auto">;
  modelName: string;
  externalJobId?: string | null;
  /** Public or temporary media URL from the provider. */
  resultUrl?: string | null;
  mimeType?: string | null;
  /** Optional binary payload when the provider returns bytes instead of a URL. */
  resultBytes?: Uint8Array | null;
  costCents?: number | null;
  metadata?: Record<string, unknown>;
}

export interface JobResultFailure {
  ok: false;
  provider: Exclude<GenerationProviderId, "auto"> | "auto";
  code: ProviderFailureCode;
  message: string;
  externalJobId?: string | null;
  metadata?: Record<string, unknown>;
}

export type JobResult = JobResultSuccess | JobResultFailure;

export interface GenerationProvider {
  id: Exclude<GenerationProviderId, "auto">;
  displayName: string;
  supportedModalities: GenerationModality[];
  isConfigured(): boolean;
  generate(request: JobRequest): Promise<JobResult>;
}

export type CreateGenerationProvider = () => GenerationProvider;

export interface EnvAvailability {
  openai: boolean;
  googleOmni: boolean;
  fal: boolean;
  xai: boolean;
  runway: boolean;
}

export function readEnvAvailability(env: NodeJS.ProcessEnv = process.env): EnvAvailability {
  return {
    openai: Boolean(env.OPENAI_API_KEY?.trim()),
    googleOmni: Boolean(
      env.GOOGLE_OMNI_API_KEY?.trim() ||
        env.GOOGLE_API_KEY?.trim() ||
        env.GEMINI_API_KEY?.trim(),
    ),
    fal: Boolean(env.FAL_KEY?.trim()),
    xai: Boolean(env.XAI_API_KEY?.trim()),
    runway: Boolean(env.RUNWAYML_API_SECRET?.trim() || env.RUNWAY_API_KEY?.trim()),
  };
}
