import { headers } from "next/headers";

const NETLIFY_FALLBACK = "https://ffs-mission-control.netlify.app";

/**
 * Public site origin for auth redirects (password reset, etc.).
 * Prefer NEXT_PUBLIC_SITE_URL; otherwise derive from request headers / VERCEL_URL / Netlify fallback.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    // headers() unavailable outside a request (e.g. tests) — fall through
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }

  return NETLIFY_FALLBACK;
}

/** Sync variant for non-request contexts (build-time checks, pure helpers). */
export function resolveSiteUrlSync(
  env: { NEXT_PUBLIC_SITE_URL?: string; VERCEL_URL?: string } = {},
): string {
  const configured = (env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL)?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const vercel = (env.VERCEL_URL ?? process.env.VERCEL_URL)?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return NETLIFY_FALLBACK;
}
