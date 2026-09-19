import { login, personalBypass, signup } from "./actions";
import { isPersonalBypassEnabled } from "@/lib/studio-bypass";

function errorCopy(error?: string) {
  switch (error) {
    case "credentials":
      return "Invalid email or password.";
    case "configuration":
      return "Studio auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";
    case "confirm":
      return "Check your email to confirm your account, then sign in.";
    case "membership":
      return "Could not establish studio membership. Apply migration 0004 or use personal bypass.";
    case "signup":
      return "Could not create the account. The email may already be registered.";
    case "bypass_config":
      return "Personal bypass requires SUPABASE_SERVICE_ROLE_KEY (and a valid Supabase URL).";
    case "bypass_secret":
      return "Bypass secret did not match.";
    default:
      return error ? "Authentication failed. Check credentials and configuration." : null;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = errorCopy(error);
  const bypassEnabled = isPersonalBypassEnabled();
  const bypassSecretRequired = Boolean(process.env.FP_STUDIO_BYPASS_SECRET);

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Restricted studio</div>
        <h1>Operator sign in.</h1>
        <p className="lede">
          Authenticate to enter F&amp;P Studio — Wardell&apos;s personal commercial production
          environment.
        </p>
        {message && <p className="error">{message}</p>}

        <form action={login} className="form">
          <div className="eyebrow">Sign in</div>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <button className="button" type="submit">
            Enter F&amp;P Studio
          </button>
        </form>

        <form action={signup} className="form">
          <div className="eyebrow">Create account</div>
          <p className="muted">
            First-time operators can create a password account. Migration 0004 bootstraps personal
            studio membership automatically.
          </p>
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button className="button secondary" type="submit">
            Create account
          </button>
        </form>

        {bypassEnabled && (
          <form action={personalBypass} className="form">
            <div className="eyebrow">Temporary personal bypass</div>
            <p className="muted">
              Env-gated operator entry while membership bootstrap is being applied. Disable
              FP_STUDIO_PERSONAL_BYPASS when normal auth works.
            </p>
            {bypassSecretRequired && (
              <label>
                Bypass secret
                <input name="bypass_secret" type="password" required autoComplete="off" />
              </label>
            )}
            <button className="button secondary" type="submit">
              Enter with personal bypass
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
