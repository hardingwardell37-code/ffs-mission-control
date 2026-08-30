import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";
import { isAuthRoute, isPreviewMode } from "@/lib/preview-mode";
type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function middleware(request: NextRequest) {
  const previewHost = request.nextUrl.hostname.startsWith("deploy-preview-") && request.nextUrl.hostname.endsWith("--ffs-mission-control.netlify.app");
  if (isPreviewMode() || previewHost) {
    return request.nextUrl.pathname === "/" ? NextResponse.next({ request }) : NextResponse.redirect(new URL("/", request.url));
  }
  if (isAuthRoute(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/login?error=configuration", request.url));
  const supabase = createServerClient(url, key, { cookies: { getAll: () => request.cookies.getAll(), setAll: (items: CookieToSet[]) => { items.forEach(({ name, value }) => request.cookies.set(name, value)); response = NextResponse.next({ request }); items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); } } });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
  return response;
}

export const config = { matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico).*)"] };
