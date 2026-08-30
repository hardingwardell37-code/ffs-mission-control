import { redirect } from "next/navigation";
import { isPreviewMode } from "@/lib/preview-mode";
import { createPreviewClient } from "@/lib/supabase/preview";
import { createClient } from "@/lib/supabase/server";

export async function requireContext() {
  if (isPreviewMode()) {
    const supabase = createPreviewClient();
    const { data: organization, error } = await supabase.from("organizations").select("id").eq("name", "Forged Field Systems").limit(1).maybeSingle();
    if (error || !organization) throw new Error("Forged Field Systems preview organization is unavailable");
    return { supabase, user: { id: "preview-read-only", email: "Preview mode" }, organizationId: organization.id as string, role: "preview-read-only", previewMode: true as const };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership, error } = await supabase.from("organization_memberships").select("organization_id, role").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
  if (error || !membership) throw new Error("No active organization membership");
  return { supabase, user, organizationId: membership.organization_id as string, role: membership.role as string, previewMode: false as const };
}

export async function requireWriteContext() {
  if (isPreviewMode()) throw new Error("Mission Control preview mode is read-only");
  return requireContext();
}
