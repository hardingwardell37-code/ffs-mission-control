"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password.length < 12) return setError("Password must be at least 12 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setBusy(true);
    const { error: updateError } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError("The recovery link is invalid or expired. Request a new link.");
    router.replace("/login?reset=1");
  }

  return <form className="form" onSubmit={submit}>{error && <p className="error">{error}</p>}<label>New password<input name="password" type="password" required minLength={12} autoComplete="new-password" /></label><label>Confirm new password<input name="confirmation" type="password" required minLength={12} autoComplete="new-password" /></label><button className="button" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button></form>;
}
