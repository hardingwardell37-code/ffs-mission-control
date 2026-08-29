import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return <main className="auth-shell"><div className="auth-card"><div className="eyebrow">Account recovery</div><h1>Choose a new password.</h1><p className="lede">Use at least 12 characters.</p><ResetPasswordForm /></div></main>;
}
