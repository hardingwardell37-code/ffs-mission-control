/** Durable campaign media in Supabase Storage bucket `campaign-assets`. */

export const CAMPAIGN_ASSETS_BUCKET = "campaign-assets";

type StorageClient = {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        data: Uint8Array | Blob | ArrayBuffer,
        options?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ error: { message: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
};

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export function extFromMime(mimeType: string | null | undefined, fallback: "png" | "mp4" = "png"): string {
  if (!mimeType) return fallback;
  const key = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (MIME_EXT[key]) return MIME_EXT[key];
  if (key.startsWith("video/")) return "mp4";
  if (key.startsWith("image/")) return "png";
  return fallback;
}

export function generatedObjectPath(campaignId: string, jobId: string, mimeType: string | null | undefined): string {
  const fallback = mimeType?.startsWith("video/") ? "mp4" : "png";
  return `generated/${campaignId}/${jobId}.${extFromMime(mimeType, fallback as "png" | "mp4")}`;
}

export function isImageAsset(mimeType: string | null | undefined, url?: string | null): boolean {
  if (mimeType?.toLowerCase().startsWith("image/")) return true;
  if (!url) return false;
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(url);
}

export function isVideoAsset(mimeType: string | null | undefined, url?: string | null): boolean {
  if (mimeType?.toLowerCase().startsWith("video/")) return true;
  if (!url) return false;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

export async function fetchRemoteMedia(
  url: string,
): Promise<{ bytes: Uint8Array; mimeType: string | null } | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) return null;
    const mimeType = res.headers.get("content-type");
    return { bytes: new Uint8Array(buf), mimeType };
  } catch {
    return null;
  }
}

/**
 * Upload bytes to `campaign-assets` at `generated/{campaign_id}/{job_id}.{ext}`.
 * Returns path + public URL (same contract as client uploads).
 */
export async function uploadGeneratedBytes(
  supabase: StorageClient,
  opts: {
    campaignId: string;
    jobId: string;
    bytes: Uint8Array;
    mimeType: string;
  },
): Promise<{ storagePath: string; storageUrl: string }> {
  const storagePath = generatedObjectPath(opts.campaignId, opts.jobId, opts.mimeType);
  const { error } = await supabase.storage.from(CAMPAIGN_ASSETS_BUCKET).upload(storagePath, opts.bytes, {
    contentType: opts.mimeType,
    upsert: true,
  });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(CAMPAIGN_ASSETS_BUCKET).getPublicUrl(storagePath);
  return { storagePath, storageUrl: data.publicUrl };
}
