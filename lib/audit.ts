import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeAudit(supabase: SupabaseClient, event: { organizationId: string; actorId: string; eventType: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  const { error } = await supabase.from("audit_events").insert({ organization_id: event.organizationId, actor_type: "user", actor_id: event.actorId, event_type: event.eventType, entity_type: event.entityType, entity_id: event.entityId, metadata: event.metadata ?? {} });
  if (error) throw error;
}
