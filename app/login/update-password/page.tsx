import Link from "next/link";
import { redirect } from "next/navigation";
import { updatePassword } from "../actions";
import { RecoverySession } from "@/components/recovery-session";
import { createClient } from "@/lib/supabase/server";

function errorCopy(error?: string) {
  switch (error) {
    case "configuration":
      return "Studio auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
    case "session":
      return "No recovery session. Open the link from your reset email, or request a new one.";
    case "password":
      return "Password must be at least 8 characters.";
    case "mismatch":
      return "Passwords do not match.";
    case "update":
      return "Could not update password. Request a new reset link and try again.";
    case "recovery":
      return "Could not establish a recovery session from the reset link.";
    default:
      return error ? "Password update failed." : null;
  }
}

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>;
}) {
  const { error, code } = await searchParams;

  // PKCE: if the email link landed here with ?code= (instead of /auth/callback), exchange it.
  if (code) {
    try {
      const supabase = await createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) redirect("/login/update-password?error=recovery");
      redirect("/login/update-password");
    } catch {
      redirect("/login/update-password?error=configuration");
    }
  }

  let sessionReady = false;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    sessionReady = Boolean(user);
  } catch {
    sessionReady = false;
  }

  const message = errorCopy(error);

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Password recovery</div>
        <h1>Set a new password.</h1>
        <p className="lede">
          Choose a new password for your F&amp;P Studio account. You must arrive here from a valid
          reset email link.
        </p>

        <RecoverySession />

        {message && <p className="error">{message}</p>}
        {!sessionReady && !error && (
          <p className="muted">
            Waiting for recovery session… If this page did not open from your email link,{" "}
            <Link href="/login/forgot">request a new reset</Link>.
          </p>
        )}

        <form action={updatePassword} className="form">
          <label>
            New password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            Confirm password
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button className="button" type="submit">
            Update password
          </button>
        </form>

        <p className="muted" style={{ marginTop: 20 }}>
          <Link href="/login">Back to sign in</Link>
          {" · "}
          <Link href="/login/forgot">Request another link</Link>
        </p>
      </div>
    </main>
  );
}
