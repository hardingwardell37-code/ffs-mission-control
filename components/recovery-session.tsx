"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

/**
 * Handles hash-based recovery tokens (implicit flow) by establishing a browser session.
 * PKCE `?code=` is handled by /auth/callback before this page loads.
 */
export function RecoverySession() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "working" | "ready" | "error">("idle");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash?.replace(/^#/, "");
    if (!hash) {
      setStatus("ready");
      return;
    }

    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");
    const type = params.get("type");

    if (!access_token || !refresh_token) {
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("working");

    (async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (cancelled) return;
        // Clear sensitive tokens from the URL bar without a full reload.
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        if (error) {
          setStatus("error");
          router.replace("/login/update-password?error=recovery");
          return;
        }
        if (type && type !== "recovery") {
          // Still allow update if we have a valid session from the link.
        }
        setStatus("ready");
        router.refresh();
      } catch {
        if (!cancelled) {
          setStatus("error");
          router.replace("/login/update-password?error=recovery");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (status === "working") {
    return <p className="muted">Establishing recovery session…</p>;
  }
  if (status === "error") {
    return <p className="error">Could not establish a recovery session. Request a new reset link.</p>;
  }
  return null;
}
