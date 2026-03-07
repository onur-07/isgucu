import type { SupabaseClient } from "@supabase/supabase-js";

type AuditPayload = {
  actorId?: string;
  actorRole?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export async function logAuditEvent(
  supabase: SupabaseClient,
  payload: AuditPayload
): Promise<void> {
  try {
    const action = String(payload.action || "").trim();
    if (!action) return;
    await supabase.from("admin_audit_logs").insert([
      {
        actor_id: payload.actorId || null,
        actor_role: payload.actorRole || null,
        action,
        target_type: payload.targetType || null,
        target_id: payload.targetId || null,
        metadata: payload.metadata || {},
      },
    ]);
  } catch {
    // Best-effort logging. Should not block business flow.
  }
}
