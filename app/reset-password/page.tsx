import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <main className="auth-shell"><div className="auth-card"><div className="eyebrow">Account recovery</div><h1>Choose a new password.</h1><p className="lede">Use at least 12 characters.</p><ResetPasswordForm recoveryCode={code ?? null} /></div></main>;
}
