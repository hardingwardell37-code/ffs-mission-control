import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const { sent } = await searchParams;
  return <main className="auth-shell"><div className="auth-card"><div className="eyebrow">Account recovery</div><h1>Reset password.</h1><p className="lede">Enter your account email to request a secure recovery link.</p>{sent && <p className="notice">If an account matches that email, a recovery link has been sent.</p>}<form action={requestPasswordReset} className="form"><input name="origin" type="hidden" value={process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"} /><label>Email<input name="email" type="email" required autoComplete="email" /></label><button className="button" type="submit">Send recovery link</button><Link className="auth-link" href="/login">Back to sign in</Link></form></div></main>;
}
