import Link from "next/link";
import { requestPasswordReset } from "../actions";

function errorCopy(error?: string) {
  switch (error) {
    case "configuration":
      return "Studio auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
    case "email":
      return "Enter the email address for your studio account.";
    case "reset":
      return "Could not send a reset email. Check Supabase Auth email settings and try again.";
    default:
      return error ? "Password reset failed." : null;
  }
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const { error, sent } = await searchParams;
  const message = errorCopy(error);

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Password recovery</div>
        <h1>Forgot password.</h1>
        <p className="lede">
          Enter your studio email. If an account exists, Supabase will send a reset link that returns
          you here to choose a new password.
        </p>
        {sent === "1" && (
          <p className="success">
            If that email is registered, a reset link is on its way. Check your inbox (and spam), then
            open the link to set a new password.
          </p>
        )}
        {message && <p className="error">{message}</p>}

        <form action={requestPasswordReset} className="form">
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button className="button" type="submit">
            Send reset link
          </button>
        </form>

        <p className="muted" style={{ marginTop: 20 }}>
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
