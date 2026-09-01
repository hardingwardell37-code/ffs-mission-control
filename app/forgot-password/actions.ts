"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function passwordResetOrigin() {
  const configuredOrigin = process.env.DEPLOY_PRIME_URL ?? process.env.URL;

  if (configuredOrigin) {
    return new URL(configuredOrigin).origin;
  }

  const requestHeaders = await headers();
  const requestOrigin = requestHeaders.get("origin");

  if (requestOrigin) {
    return new URL(requestOrigin).origin;
  }

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  if (!host) {
    throw new Error("Unable to determine the password-reset origin.");
  }

  return `${protocol}://${host}`;
}

export async function requestPasswordReset(form: FormData) {
  const email = String(form.get("email") ?? "").trim();

  if (email) {
    const supabase = await createClient();
    const origin = await passwordResetOrigin();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password/callback`,
    });
  }

  redirect("/forgot-password?sent=1");
}
