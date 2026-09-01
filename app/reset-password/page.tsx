import { ResetPasswordForm } from "./reset-password-form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ code?: string; error?: string }> }) {
  const { code } = await searchParams;

  if (code) {
    redirect(`/reset-password/callback?code=${encodeURIComponent(code)}`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <main className="auth-shell"><div className="auth-card"><div className="eyebrow">Account recovery</div><h1>Recovery link unavailable.</h1><p className="error">The recovery link is missing, invalid, expired, or has already been used.</p><Link href="/forgot-password">Request a new recovery link</Link></div></main>;
  }

  return <main className="auth-shell"><div className="auth-card"><div className="eyebrow">Account recovery</div><h1>Choose a new password.</h1><p className="lede">Use at least 12 characters.</p><ResetPasswordForm /></div></main>;
}
