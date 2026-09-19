import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BYPASS_COOKIE,
  BYPASS_OPERATOR_EMAIL,
  BYPASS_ORG_NAME,
  BYPASS_ORG_SLUG,
  isPersonalBypassEnabled,
} from "@/lib/studio-bypass";

type StudioContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
  organizationId: string;
  role: string;
};

async function ensureBypassOperator(admin: ReturnType<typeof createAdminClient>): Promise<User> {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (!listError) {
    const existing = listed.users.find((u) => u.email === BYPASS_OPERATOR_EMAIL);
    if (existing) return existing;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: BYPASS_OPERATOR_EMAIL,
    email_confirm: true,
    password: `${crypto.randomUUID()}Aa1!`,
    user_metadata: { display_name: "Wardell", bypass: true },
  });
  if (error || !data.user) {
    redirect("/login?error=bypass_config");
  }
  return data.user;
}

async function requireBypassContext(): Promise<StudioContext> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    redirect("/login?error=bypass_config");
  }

  let { data: org } = await admin.from("organizations").select("id").eq("slug", BYPASS_ORG_SLUG).maybeSingle();
  if (!org) {
    const { data, error } = await admin
      .from("organizations")
      .insert({ name: BYPASS_ORG_NAME, slug: BYPASS_ORG_SLUG })
      .select("id")
      .single();
    if (error || !data) redirect("/login?error=bypass_config");
    org = data;
  }

  const user = await ensureBypassOperator(admin);

  await admin.from("profiles").upsert({
    id: user.id,
    display_name: "Wardell",
    updated_at: new Date().toISOString(),
  });

  const { error: membershipError } = await admin.from("organization_memberships").upsert(
    {
      organization_id: org.id,
      user_id: user.id,
      role: "owner",
      status: "active",
    },
    { onConflict: "organization_id,user_id" },
  );
  if (membershipError) redirect("/login?error=bypass_config");

  return {
    supabase: admin as unknown as Awaited<ReturnType<typeof createClient>>,
    user,
    organizationId: org.id as string,
    role: "owner",
  };
}

export async function requireContext(): Promise<StudioContext> {
  if (isPersonalBypassEnabled()) {
    const store = await cookies();
    if (store.get(BYPASS_COOKIE)?.value === "1") {
      return requireBypassContext();
    }
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login?error=configuration");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let { data: membership, error } = await supabase
    .from("organization_memberships")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const { error: rpcError } = await supabase.rpc("ensure_studio_access");
    if (rpcError) redirect("/login?error=membership");

    ({ data: membership, error } = await supabase
      .from("organization_memberships")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle());
  }

  if (error || !membership) redirect("/login?error=membership");

  return {
    supabase,
    user,
    organizationId: membership.organization_id as string,
    role: membership.role as string,
  };
}
