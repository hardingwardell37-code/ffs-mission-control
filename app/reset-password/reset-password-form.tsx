"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm({ recoveryCode }: { recoveryCode: string | null }) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const exchangeStarted = useRef(false);

  useEffect(() => {
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    if (!recoveryCode) {
      setError("The recovery link is invalid or expired. Request a new link.");
      return;
    }

    void supabase.auth.exchangeCodeForSession(recoveryCode).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setError("The recovery link is invalid or expired. Request a new link.");
        return;
      }
      setRecoveryReady(true);
    });
  }, [recoveryCode, supabase]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError("The recovery link is invalid or expired. Request a new link.");
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login?reset=1");
  }

  return <form className="form" onSubmit={submit}>{error && <p className="error">{error}</p>}<label>New password<input name="password" type="password" required minLength={12} autoComplete="new-password" disabled={!recoveryReady || busy} /></label><label>Confirm new password<input name="confirmation" type="password" required minLength={12} autoComplete="new-password" disabled={!recoveryReady || busy} /></label><button className="button" type="submit" disabled={!recoveryReady || busy}>{busy ? "Updating…" : recoveryReady ? "Update password" : "Verifying recovery link…"}</button></form>;
}
