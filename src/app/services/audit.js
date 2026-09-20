// Audit trail for critical events. Immutable records; summaries only — no amounts, notes, or document content.
import { repo } from "@/adapters/base44/entities";

export async function writeAudit({ userId, action, entityType, entityId, before, after, reason }) {
  try {
    await repo("AuditLog").create({
      user_id: userId,
      actor_user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      occurred_at: new Date().toISOString(),
      safe_before_summary: before ? JSON.stringify(before).slice(0, 300) : undefined,
      safe_after_summary: after ? JSON.stringify(after).slice(0, 300) : undefined,
      reason
    });
  } catch (e) {
    // Audit must never break a user action, but it is never silently ignored in the console.
    console.warn("audit_write_failed", action, e?.code);
  }
}