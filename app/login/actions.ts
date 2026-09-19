"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BYPASS_COOKIE, isPersonalBypassEnabled } from "@/lib/studio-bypass";

async function ensureAccessOrRedirect(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { error } = await supabase.rpc("ensure_studio_access");
  if (error) redirect("/login?error=membership");
}

export async function login(form: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login?error=configuration");
  }

  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) redirect("/login?error=credentials");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");

  await ensureAccessOrRedirect(supabase);
  redirect("/");
}

export async function signup(form: FormData) {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login?error=configuration");
  }

  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) redirect("/login?error=credentials");
  if (password.length < 8) redirect("/login?error=credentials");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) redirect("/login?error=signup");
  if (!data.session) redirect("/login?error=confirm");

  await ensureAccessOrRedirect(supabase);
  redirect("/");
}

export async function personalBypass(form: FormData) {
  if (!isPersonalBypassEnabled()) {
    redirect("/login?error=configuration");
  }

  const expected = process.env.FP_STUDIO_BYPASS_SECRET;
  if (expected) {
    const provided = String(form.get("bypass_secret") ?? "");
    if (provided !== expected) redirect("/login?error=bypass_secret");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    redirect("/login?error=bypass_config");
  }

  const store = await cookies();
  store.set(BYPASS_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/");
}
