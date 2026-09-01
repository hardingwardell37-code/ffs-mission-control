import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!tokenHash && !code) {
    return NextResponse.redirect(new URL("/reset-password?error=missing-token", url.origin));
  }

  const supabase = await createClient();
  const { error } = tokenHash
    ? type === "recovery"
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
      : { error: new Error("Invalid recovery type") }
    : await supabase.auth.exchangeCodeForSession(code!);

  if (error) {
    return NextResponse.redirect(new URL("/reset-password?error=invalid-token", url.origin));
  }

  return NextResponse.redirect(new URL("/reset-password", url.origin));
}
