"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestPasswordReset(form: FormData) {
  const email = String(form.get("email") ?? "").trim();

  if (email) {
    const supabase = await createClient();
    const origin = String(form.get("origin") ?? "");
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });
  }

  redirect("/forgot-password?sent=1");
}
