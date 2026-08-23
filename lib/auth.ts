import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership, error } = await supabase.from("organization_memberships").select("organization_id, role").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (error || !membership) throw new Error("No active organization membership");
  return { supabase, user, organizationId: membership.organization_id as string, role: membership.role as string };
}
