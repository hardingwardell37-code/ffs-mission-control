import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Exchanges a Supabase auth `code` (PKCE) for a session cookie, then redirects.
 * Used by password recovery and other email links when SSR cannot read the hash.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const nextRaw = searchParams.get("next") ?? "/login/update-password";
  const next = nextRaw.startsWith("/") ? nextRaw : "/login/update-password";

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, origin));
      }
    } catch {
      // configuration missing or exchange failed
    }
    return NextResponse.redirect(new URL("/login/update-password?error=recovery", origin));
  }

  return NextResponse.redirect(new URL(next, origin));
}
