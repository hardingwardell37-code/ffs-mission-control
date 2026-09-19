import { login } from "./actions";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="eyebrow">Restricted studio</div>
        <h1>Operator sign in.</h1>
        <p className="lede">Authenticate to enter F&amp;P Studio — Wardell&apos;s personal commercial production environment.</p>
        {error && <p className="error">Authentication failed. Check your credentials and configuration.</p>}
        <form action={login} className="form">
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" required autoComplete="current-password" /></label>
          <button className="button" type="submit">Enter F&amp;P Studio</button>
        </form>
      </div>
    </main>
  );
}
